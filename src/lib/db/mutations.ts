import { toISODate } from "@/lib/dates";
import { occurrenceAfter, type Frequency } from "@/lib/recurrence";
import { extractTags } from "@/lib/tags";
import { favouriteKey } from "@/lib/favourites";
import { deterministicUUID } from "@/lib/uuid";
import type {
  Budget,
  Category,
  Expense,
  Favourite,
  Group,
  GroupExpense,
  GroupMember,
  GroupRecurringRule,
  Kind,
  LocalDB,
  OutboxItem,
  PaymentMethod,
  Profile,
  RecurringRule,
  RowTable,
  Settlement,
  SyncTable,
} from "./local";

// Every write goes to the local DB and the outbox in one transaction, then asks the sync
// engine to push. The UI updates immediately (live queries) whether or not we're online.

let requestSync: () => void = () => {};
export function setSyncRequester(fn: () => void) {
  requestSync = fn;
}

const now = () => new Date().toISOString();

async function enqueue(
  db: LocalDB,
  table: SyncTable,
  rowId: string,
  payload: Record<string, unknown>,
  op: OutboxItem["op"] = "upsert",
) {
  const [first, ...rest] = await db.outbox.where("rowId").equals(rowId).sortBy("seq");
  if (!first) {
    await db.outbox.add({ table, rowId, payload, op, version: 0 } satisfies OutboxItem);
    return;
  }
  // Merge into the earliest pending change for this row and keep its place in the queue:
  // re-adding it at the end would push a new rule after the expenses that reference it.
  const merged = Object.assign({}, first.payload, ...rest.map((item) => item.payload), payload);
  await db.outbox.update(first.seq!, { payload: merged, version: (first.version ?? 0) + 1 });
  if (rest.length) await db.outbox.bulkDelete(rest.map((item) => item.seq!));
}

type Row =
  | Expense
  | Category
  | PaymentMethod
  | Budget
  | RecurringRule
  | Favourite
  | GroupExpense
  | Settlement
  | GroupRecurringRule;

async function putRows(db: LocalDB, table: RowTable, rows: Row[], op: OutboxItem["op"] = "upsert") {
  await db.transaction("rw", db.table(table), db.outbox, async () => {
    for (const row of rows) {
      await db.table(table).put(row);
      await enqueue(db, table, row.id, row, op);
    }
  });
  requestSync();
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseInput = Pick<
  Expense,
  "amount_minor" | "currency" | "category_id" | "payment_method_id" | "note" | "spent_on"
> & {
  kind?: Kind;
  recurring_rule_id?: string | null;
  id?: string;
  reimbursable?: boolean;
  receipt_path?: string | null;
  group_expense_id?: string | null;
};

function buildExpense(db: LocalDB, input: ExpenseInput): Expense {
  const timestamp = now();
  const note = input.note?.trim() || null;
  return {
    id: input.id ?? crypto.randomUUID(),
    user_id: db.userId,
    amount_minor: input.amount_minor,
    currency: input.currency,
    category_id: input.category_id,
    payment_method_id: input.payment_method_id,
    spent_on: input.spent_on,
    kind: input.kind ?? "expense",
    note,
    tags: extractTags(note),
    recurring_rule_id: input.recurring_rule_id ?? null,
    reimbursable: input.reimbursable ?? false,
    reimbursed_at: null,
    receipt_path: input.receipt_path ?? null,
    group_expense_id: input.group_expense_id ?? null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
}

export async function createExpense(db: LocalDB, input: ExpenseInput): Promise<Expense> {
  const expense = buildExpense(db, input);
  await putRows(db, "expenses", [expense]);
  return expense;
}

export async function updateExpense(db: LocalDB, expense: Expense, changes: Partial<ExpenseInput>) {
  const note = changes.note === undefined ? expense.note : changes.note?.trim() || null;
  await putRows(db, "expenses", [{ ...expense, ...changes, note, tags: extractTags(note), updated_at: now() }]);
}

/** Marks a work expense as paid back (or undoes that). */
export async function setReimbursed(db: LocalDB, expense: Expense, reimbursed: boolean) {
  await putRows(db, "expenses", [{ ...expense, reimbursed_at: reimbursed ? now() : null, updated_at: now() }]);
}

export async function deleteExpense(db: LocalDB, expense: Expense) {
  await putRows(db, "expenses", [{ ...expense, deleted_at: now(), updated_at: now() }]);
}

export async function restoreExpense(db: LocalDB, expense: Expense) {
  await putRows(db, "expenses", [{ ...expense, deleted_at: null, updated_at: now() }]);
}

export async function duplicateExpense(db: LocalDB, expense: Expense, spentOn: string) {
  const { amount_minor, currency, category_id, payment_method_id, note, kind } = expense;
  return createExpense(db, {
    amount_minor,
    currency,
    category_id,
    payment_method_id,
    note,
    kind: kind === "income" ? "income" : "expense",
    spent_on: spentOn,
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryInput = Pick<Category, "name" | "emoji" | "color"> & { kind?: Kind };

export async function createCategory(db: LocalDB, input: CategoryInput): Promise<Category> {
  const categories = await db.categories.toArray();
  const timestamp = now();
  const category: Category = {
    id: crypto.randomUUID(),
    user_id: db.userId,
    name: input.name.trim(),
    emoji: input.emoji,
    color: input.color,
    kind: input.kind ?? "expense",
    sort_order: Math.max(-1, ...categories.map((c) => c.sort_order)) + 1,
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await putRows(db, "categories", [category]);
  return category;
}

export async function updateCategory(
  db: LocalDB,
  category: Category,
  changes: Partial<CategoryInput & Pick<Category, "is_archived" | "sort_order">>,
) {
  const name = changes.name?.trim() ?? category.name;
  await putRows(db, "categories", [{ ...category, ...changes, name, updated_at: now() }]);
}

export async function reorderCategories(db: LocalDB, ordered: Category[]) {
  const changed = ordered
    .map((category, index) => ({ category, index }))
    .filter(({ category, index }) => category.sort_order !== index)
    .map(({ category, index }) => ({ ...category, sort_order: index, updated_at: now() }));
  if (changed.length) await putRows(db, "categories", changed);
}

/** Deletes a category, moving all its expenses (including deleted ones) to `moveTo`. */
export async function deleteCategory(db: LocalDB, category: Category, moveTo: Category | null) {
  const expenses = await db.expenses.where("category_id").equals(category.id).toArray();
  if (expenses.length && !moveTo) throw new Error("Choose where to move this category's expenses.");
  const timestamp = now();
  await putRows(
    db,
    "expenses",
    expenses.map((e) => ({ ...e, category_id: moveTo!.id, updated_at: timestamp })),
  );
  await putRows(db, "categories", [{ ...category, deleted_at: timestamp, updated_at: timestamp }]);
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export async function createPaymentMethod(db: LocalDB, name: string): Promise<PaymentMethod> {
  const methods = await db.payment_methods.toArray();
  const timestamp = now();
  const method: PaymentMethod = {
    id: crypto.randomUUID(),
    user_id: db.userId,
    name: name.trim(),
    icon: "wallet",
    sort_order: Math.max(-1, ...methods.map((m) => m.sort_order)) + 1,
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await putRows(db, "payment_methods", [method]);
  return method;
}

export async function renamePaymentMethod(db: LocalDB, method: PaymentMethod, name: string) {
  await putRows(db, "payment_methods", [{ ...method, name: name.trim(), updated_at: now() }]);
}

/** Deletes a payment method; its expenses simply lose the (optional) method. */
export async function deletePaymentMethod(db: LocalDB, method: PaymentMethod) {
  const timestamp = now();
  const expenses = await db.expenses.filter((e) => e.payment_method_id === method.id).toArray();
  await putRows(
    db,
    "expenses",
    expenses.map((e) => ({ ...e, payment_method_id: null, updated_at: timestamp })),
  );
  await putRows(db, "payment_methods", [{ ...method, deleted_at: timestamp, updated_at: timestamp }]);
}

// ---------------------------------------------------------------------------
// Profile (partial updates)
// ---------------------------------------------------------------------------

export type ProfileChanges = Partial<
  Pick<
    Profile,
    | "display_name"
    | "currency"
    | "month_start_day"
    | "week_start"
    | "theme"
    | "show_payment_method"
    | "track_income"
    | "timezone"
    | "notify_daily"
    | "notify_daily_hour"
    | "notify_bills"
    | "notify_weekly"
    | "notify_groups"
    | "notify_budgets"
    | "notify_settle"
  >
>;

export async function updateProfile(db: LocalDB, changes: ProfileChanges) {
  await db.transaction("rw", db.profiles, db.outbox, async () => {
    await db.profiles.update(db.userId, { ...changes, updated_at: now() });
    await enqueue(db, "profiles", db.userId, changes);
  });
  requestSync();
}

// ---------------------------------------------------------------------------
// Budgets (one active budget per category; category null = overall)
// ---------------------------------------------------------------------------

/** Sets, changes or (with amount null) removes the budget for a category or overall. */
export async function setBudget(db: LocalDB, categoryId: string | null, amountMinor: number | null) {
  const existing = (await db.budgets.toArray()).find((b) => !b.deleted_at && b.category_id === categoryId);
  const timestamp = now();
  if (amountMinor === null || amountMinor <= 0) {
    if (existing) await putRows(db, "budgets", [{ ...existing, deleted_at: timestamp, updated_at: timestamp }]);
    return;
  }
  const budget: Budget = existing
    ? { ...existing, amount_minor: amountMinor, updated_at: timestamp }
    : {
        id: crypto.randomUUID(),
        user_id: db.userId,
        category_id: categoryId,
        amount_minor: amountMinor,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };
  await putRows(db, "budgets", [budget]);
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

/** Occurrence ids are derived from rule + date, so every device creates the same row. */
const occurrenceId = (ruleId: string, date: string) => deterministicUUID(`${ruleId}:${date}`);

type RepeatInput = ExpenseInput & { frequency: Frequency; interval?: number; mode?: "auto" | "ask" };

/** Saves the first occurrence now and a rule that adds the next ones on their due dates. */
export async function createRecurringExpense(db: LocalDB, input: RepeatInput): Promise<Expense> {
  const timestamp = now();
  const note = input.note?.trim() || null;
  const schedule = { frequency: input.frequency, interval: input.interval ?? 1, anchor_date: input.spent_on };
  const rule: RecurringRule = {
    id: crypto.randomUUID(),
    user_id: db.userId,
    kind: input.kind ?? "expense",
    amount_minor: input.amount_minor,
    currency: input.currency,
    category_id: input.category_id,
    payment_method_id: input.payment_method_id,
    note,
    tags: extractTags(note),
    ...schedule,
    next_due_on: occurrenceAfter(schedule, input.spent_on),
    mode: input.mode ?? "auto",
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  // Rule first: the outbox pushes in order, and the expense references it.
  await putRows(db, "recurring_rules", [rule]);
  const expense = buildExpense(db, {
    ...input,
    recurring_rule_id: rule.id,
    id: await occurrenceId(rule.id, input.spent_on),
  });
  await putRows(db, "expenses", [expense]);
  await catchUpRule(db, rule); // a start date in the past may already have due occurrences
  return expense;
}

export type RuleChanges = Partial<
  Pick<
    RecurringRule,
    "amount_minor" | "category_id" | "payment_method_id" | "note" | "frequency" | "interval" | "mode" | "is_active"
  >
>;

export async function updateRecurringRule(db: LocalDB, rule: RecurringRule, changes: RuleChanges) {
  const note = changes.note === undefined ? rule.note : changes.note?.trim() || null;
  const updated: RecurringRule = { ...rule, ...changes, note, tags: extractTags(note), updated_at: now() };
  // A new schedule restarts from the next due date.
  if (changes.frequency !== undefined || changes.interval !== undefined) updated.anchor_date = rule.next_due_on;
  await putRows(db, "recurring_rules", [updated]);
}

/** Stops future occurrences; expenses already added stay. */
export async function deleteRecurringRule(db: LocalDB, rule: RecurringRule) {
  await putRows(db, "recurring_rules", [{ ...rule, is_active: false, deleted_at: now(), updated_at: now() }]);
}

async function occurrenceExpense(db: LocalDB, rule: RecurringRule, date: string): Promise<Expense> {
  return buildExpense(db, {
    id: await occurrenceId(rule.id, date),
    amount_minor: rule.amount_minor,
    currency: rule.currency,
    category_id: rule.category_id,
    payment_method_id: rule.payment_method_id,
    note: rule.note,
    kind: rule.kind === "income" ? "income" : "expense",
    spent_on: date,
    recurring_rule_id: rule.id,
  });
}

/** For "ask me first" rules: add (or skip) the occurrence that's due, then move to the next one. */
export async function resolveDueOccurrence(db: LocalDB, rule: RecurringRule, add: boolean) {
  if (add) {
    const expense = await occurrenceExpense(db, rule, rule.next_due_on);
    if (!(await db.expenses.get(expense.id))) await putRows(db, "expenses", [expense]);
  }
  await putRows(db, "recurring_rules", [
    { ...rule, next_due_on: occurrenceAfter(rule, rule.next_due_on), updated_at: now() },
  ]);
}

/** Adds every due occurrence of an automatic rule up to today. */
async function catchUpRule(db: LocalDB, rule: RecurringRule, today = new Date()) {
  if (!rule.is_active || rule.deleted_at || rule.mode !== "auto") return 0;
  const todayISO = localISO(today);
  const created: Expense[] = [];
  let due = rule.next_due_on;
  while (due <= todayISO && created.length < 100) {
    const expense = await occurrenceExpense(db, rule, due);
    // Never recreate one that exists, including one the user deleted.
    if (!(await db.expenses.get(expense.id))) created.push(expense);
    due = occurrenceAfter(rule, due);
  }
  if (due === rule.next_due_on) return 0;
  if (created.length) await putRows(db, "expenses", created);
  await putRows(db, "recurring_rules", [{ ...rule, next_due_on: due, updated_at: now() }]);
  return created.length;
}

let catchingUp = false;

/** Called after each sync: adds due occurrences of all automatic rules. */
export async function addDueRecurringExpenses(db: LocalDB) {
  if (catchingUp) return 0;
  catchingUp = true;
  try {
    let added = 0;
    for (const rule of await db.recurring_rules.toArray()) added += await catchUpRule(db, rule);
    return added;
  } finally {
    catchingUp = false;
  }
}

const localISO = (date: Date) => toISODate(date);

/** Adds many expenses in one go (CSV import); they sync in batches. */
export async function importExpenses(db: LocalDB, inputs: ExpenseInput[]) {
  const rows = inputs.map((input) => buildExpense(db, input));
  await putRows(db, "expenses", rows);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Groups (shared expenses)
// ---------------------------------------------------------------------------

async function putGroupRow(
  db: LocalDB,
  table: "group_members" | "groups" | "group_recurring_rules",
  row: GroupMember | Group | GroupRecurringRule,
  changes: Record<string, unknown>,
  op: "insert" | "update",
) {
  await db.transaction("rw", db.table(table), db.outbox, async () => {
    await db.table(table).put(row);
    await enqueue(db, table, row.id, op === "insert" ? row : changes, op);
  });
  requestSync();
}

/** A friend without the app, by name. They can claim this spot from the invite link later. */
export async function addNamedMember(db: LocalDB, groupId: string, name: string) {
  const timestamp = now();
  const member: GroupMember = {
    id: crypto.randomUUID(),
    group_id: groupId,
    user_id: null,
    display_name: name.trim().slice(0, 60),
    role: "member",
    upi_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await putGroupRow(db, "group_members", member, {}, "insert");
  return member;
}

export async function updateMember(
  db: LocalDB,
  member: GroupMember,
  changes: Partial<Pick<GroupMember, "display_name" | "upi_id" | "deleted_at">>,
) {
  await putGroupRow(db, "group_members", { ...member, ...changes, updated_at: now() }, changes, "update");
}

export async function updateGroup(
  db: LocalDB,
  group: Group,
  changes: Partial<Pick<Group, "name" | "emoji" | "deleted_at">>,
) {
  await putGroupRow(db, "groups", { ...group, ...changes, updated_at: now() }, changes, "update");
}

export type GroupExpenseInput = Pick<
  GroupExpense,
  "group_id" | "paid_by_member_id" | "amount_minor" | "currency" | "description" | "spent_on" | "split_mode" | "splits"
>;

export async function saveGroupExpense(db: LocalDB, input: GroupExpenseInput, existing?: GroupExpense) {
  const timestamp = now();
  const row: GroupExpense = existing
    ? { ...existing, ...input, description: input.description.trim(), updated_at: timestamp }
    : {
        id: crypto.randomUUID(),
        ...input,
        description: input.description.trim(),
        recurring_rule_id: null,
        created_by: db.userId,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };
  await putRows(db, "group_expenses", [row]);
  return row;
}

export async function deleteGroupExpense(db: LocalDB, expense: GroupExpense, deleted = true) {
  await putRows(db, "group_expenses", [{ ...expense, deleted_at: deleted ? now() : null, updated_at: now() }]);
}

export async function recordSettlement(
  db: LocalDB,
  input: Pick<Settlement, "group_id" | "from_member_id" | "to_member_id" | "amount_minor" | "currency"> & {
    note?: string | null;
  },
) {
  const timestamp = now();
  const row: Settlement = {
    id: crypto.randomUUID(),
    ...input,
    note: input.note ?? null,
    spent_on: toISODate(new Date()),
    created_by: db.userId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await putRows(db, "settlements", [row]);
  return row;
}

export async function deleteSettlement(db: LocalDB, settlement: Settlement, deleted = true) {
  await putRows(db, "settlements", [{ ...settlement, deleted_at: deleted ? now() : null, updated_at: now() }]);
}

/**
 * Mirrors your share of each group expense as a personal expense (so budgets, Insights and
 * safe-to-spend count what's yours, not the whole bill you paid). Ids come from the group
 * expense, so devices agree; edits and deletions in the group follow through, unless you've
 * edited or deleted your copy since. Deleting a group keeps the shares already mirrored.
 */
export async function syncGroupShares(db: LocalDB, guessCategory: (description: string) => string | null) {
  const myMembers = (await db.group_members.toArray()).filter((m) => m.user_id === db.userId);
  // Groups you're in now. Your share there includes any earlier spot you left and rejoined from.
  const myGroups = new Set(myMembers.filter((m) => !m.deleted_at).map((m) => m.group_id));
  if (!myGroups.size) return 0;
  const myMemberIds = new Set(myMembers.map((m) => m.id));
  const groups = new Map((await db.groups.toArray()).map((g) => [g.id, g]));
  const changed: Expense[] = [];
  const timestamp = now();

  for (const expense of await db.group_expenses.toArray()) {
    const group = groups.get(expense.group_id);
    if (!myGroups.has(expense.group_id) || !group || group.deleted_at) continue;
    const share = (expense.splits as { member_id: string; share_minor: number }[])
      .filter((s) => myMemberIds.has(s.member_id))
      .reduce((sum, s) => sum + s.share_minor, 0);
    const id = await deterministicUUID(`group-share:${expense.id}:${db.userId}`);
    const existing = await db.expenses.get(id);
    const wanted = !expense.deleted_at && share > 0;
    const note = `${expense.description} · ${group.emoji} ${group.name}`.slice(0, 500);

    if (!wanted) {
      if (existing && !existing.deleted_at) changed.push({ ...existing, deleted_at: timestamp, updated_at: timestamp });
      continue;
    }
    if (!existing) {
      const categoryId = guessCategory(expense.description);
      if (!categoryId) continue;
      changed.push(
        buildExpense(db, {
          id,
          amount_minor: share,
          currency: expense.currency,
          category_id: categoryId,
          payment_method_id: null,
          note,
          spent_on: expense.spent_on,
          group_expense_id: expense.id,
        }),
      );
      continue;
    }
    // Edited or deleted by you: stays that way unless the group expense changed afterwards
    // (a renamed group only updates the note). Compare as dates: server (+00:00) and local (Z)
    // timestamps differ as strings.
    const mineAt = Date.parse(existing.updated_at);
    if (Date.parse(expense.updated_at) <= mineAt) {
      if (Date.parse(group.updated_at) > mineAt && !existing.deleted_at && existing.note !== note)
        changed.push({ ...existing, note, tags: extractTags(note), updated_at: timestamp });
      continue;
    }
    if (
      existing.deleted_at ||
      existing.amount_minor !== share ||
      existing.spent_on !== expense.spent_on ||
      existing.note !== note ||
      existing.currency !== expense.currency
    ) {
      changed.push({
        ...existing,
        amount_minor: share,
        currency: expense.currency,
        spent_on: expense.spent_on,
        note,
        tags: extractTags(note),
        deleted_at: null,
        updated_at: timestamp,
      });
    }
  }
  if (changed.length) await putRows(db, "expenses", changed);
  return changed.length;
}

// ---------------------------------------------------------------------------
// Repeating group expenses (monthly rent split with flatmates)
// ---------------------------------------------------------------------------

const groupOccurrenceId = (ruleId: string, date: string) => deterministicUUID(`group-rule:${ruleId}:${date}`);

async function groupOccurrence(rule: GroupRecurringRule, date: string, userId: string): Promise<GroupExpense> {
  const timestamp = now();
  return {
    id: await groupOccurrenceId(rule.id, date),
    group_id: rule.group_id,
    paid_by_member_id: rule.paid_by_member_id,
    amount_minor: rule.amount_minor,
    currency: rule.currency,
    description: rule.description,
    spent_on: date,
    split_mode: rule.split_mode,
    splits: rule.splits,
    recurring_rule_id: rule.id,
    created_by: userId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
}

/** Adds a group expense that repeats every month: this one now, then one on the same day each month. */
export async function createRepeatingGroupExpense(db: LocalDB, input: GroupExpenseInput): Promise<GroupExpense> {
  const timestamp = now();
  const schedule = { frequency: "monthly", interval: 1, anchor_date: input.spent_on };
  const rule: GroupRecurringRule = {
    id: crypto.randomUUID(),
    group_id: input.group_id,
    paid_by_member_id: input.paid_by_member_id,
    amount_minor: input.amount_minor,
    currency: input.currency,
    description: input.description.trim(),
    split_mode: input.split_mode,
    splits: input.splits,
    ...schedule,
    next_due_on: occurrenceAfter(schedule, input.spent_on),
    is_active: true,
    created_by: db.userId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  // Rule first: the outbox pushes in order, and the expense references it.
  await putRows(db, "group_recurring_rules", [rule]);
  const first = await groupOccurrence(rule, input.spent_on, db.userId);
  await putRows(db, "group_expenses", [first], "create");
  await addDueGroupOccurrences(db); // a start date months ago already has due months
  return first;
}

export type GroupRuleChanges = Partial<
  Pick<
    GroupRecurringRule,
    "paid_by_member_id" | "amount_minor" | "description" | "split_mode" | "splits" | "is_active" | "deleted_at"
  >
>;

/** Changes apply to months still to come; ones already added stay as they are. */
export async function updateGroupRule(db: LocalDB, rule: GroupRecurringRule, changes: GroupRuleChanges) {
  await putGroupRow(db, "group_recurring_rules", { ...rule, ...changes, updated_at: now() }, changes, "update");
}

let addingGroupOccurrences = false;

/**
 * Called after each sync: adds the months that have come due for repeating expenses in your
 * groups. Every member's app does this; the (rule, date) ids and "create" (insert if missing)
 * mean a month is added once, and one somebody deleted stays deleted.
 */
export async function addDueGroupOccurrences(db: LocalDB, today = new Date()) {
  if (addingGroupOccurrences) return 0;
  addingGroupOccurrences = true;
  try {
    const todayISO = localISO(today);
    const myGroups = new Set(
      (await db.group_members.toArray()).filter((m) => m.user_id === db.userId && !m.deleted_at).map((m) => m.group_id),
    );
    const liveGroups = new Set((await db.groups.toArray()).filter((g) => !g.deleted_at).map((g) => g.id));
    let added = 0;
    for (const rule of await db.group_recurring_rules.toArray()) {
      if (!rule.is_active || rule.deleted_at || !myGroups.has(rule.group_id) || !liveGroups.has(rule.group_id))
        continue;
      const created: GroupExpense[] = [];
      let due = rule.next_due_on;
      while (due <= todayISO && created.length < 24) {
        const occurrence = await groupOccurrence(rule, due, db.userId);
        if (!(await db.group_expenses.get(occurrence.id))) created.push(occurrence);
        due = occurrenceAfter(rule, due);
      }
      if (due === rule.next_due_on) continue;
      if (created.length) await putRows(db, "group_expenses", created, "create");
      await putGroupRow(
        db,
        "group_recurring_rules",
        { ...rule, next_due_on: due, updated_at: now() },
        { next_due_on: due },
        "update",
      );
      added += created.length;
    }
    return added;
  } finally {
    addingGroupOccurrences = false;
  }
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export type FavouriteInput = Pick<
  Favourite,
  "amount_minor" | "currency" | "category_id" | "payment_method_id" | "note"
>;

/** Pins a spend to Home. Pinning the same amount + category + note twice keeps the first. */
export async function addFavourite(db: LocalDB, input: FavouriteInput): Promise<Favourite> {
  const pinned = (await db.favourites.toArray()).filter((f) => !f.deleted_at);
  const same = pinned.find((f) => favouriteKey(f) === favouriteKey(input));
  if (same) return same;
  const timestamp = now();
  // Only these fields: a suggestion passed in also carries `count`, which isn't a column.
  const favourite: Favourite = {
    id: crypto.randomUUID(),
    user_id: db.userId,
    amount_minor: input.amount_minor,
    currency: input.currency,
    category_id: input.category_id,
    payment_method_id: input.payment_method_id,
    note: input.note?.trim() || null,
    sort_order: Math.max(-1, ...pinned.map((f) => f.sort_order)) + 1,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await putRows(db, "favourites", [favourite]);
  return favourite;
}

export async function removeFavourite(db: LocalDB, favourite: Favourite, removed = true) {
  await putRows(db, "favourites", [{ ...favourite, deleted_at: removed ? now() : null, updated_at: now() }]);
}

/** Saves a new order (the list as the user arranged it). */
export async function reorderFavourites(db: LocalDB, ordered: Favourite[]) {
  const changed = ordered
    .map((f, index) => ({ ...f, sort_order: index }))
    .filter((f, index) => ordered[index].sort_order !== f.sort_order)
    .map((f) => ({ ...f, updated_at: now() }));
  if (changed.length) await putRows(db, "favourites", changed);
}

/** One tap: logs the favourite as today's expense. */
export async function logFavourite(db: LocalDB, favourite: Favourite) {
  return createExpense(db, {
    amount_minor: favourite.amount_minor,
    currency: favourite.currency,
    category_id: favourite.category_id,
    payment_method_id: favourite.payment_method_id,
    note: favourite.note,
    spent_on: localISO(new Date()),
  });
}
