import Dexie, { type EntityTable } from "dexie";
import type { Tables } from "@/lib/supabase/database.types";

export type Expense = Tables<"expenses">;
export type Category = Tables<"categories">;
export type PaymentMethod = Tables<"payment_methods">;
export type Profile = Tables<"profiles">;
export type Budget = Tables<"budgets">;
export type RecurringRule = Tables<"recurring_rules">;
export type Group = Tables<"groups">;
export type GroupMember = Tables<"group_members">;
export type GroupExpense = Tables<"group_expenses">;
export type Settlement = Tables<"settlements">;
export type Favourite = Tables<"favourites">;
export type GroupRecurringRule = Tables<"group_recurring_rules">;
export type Kind = "expense" | "income";

/** Rows synced before Phase 2 have no `kind`/`tags` until they're next pulled. */
export const kindOf = (row: { kind?: string | null }): Kind => (row.kind === "income" ? "income" : "expense");

/** Personal spending: expenses that aren't work costs to be claimed back. */
export const countsAsSpending = (row: { kind?: string | null; reimbursable?: boolean | null }) =>
  kindOf(row) === "expense" && !row.reimbursable;

/** Tables synced as whole rows (upsert). Profiles sync as partial updates. */
export type RowTable =
  | "expenses"
  | "categories"
  | "payment_methods"
  | "budgets"
  | "recurring_rules"
  | "favourites"
  | "groups"
  | "group_members"
  | "group_expenses"
  | "settlements"
  | "group_recurring_rules";
export type SyncTable = RowTable | "profiles";

export type OutboxItem = {
  seq?: number;
  table: SyncTable;
  rowId: string;
  payload: Record<string, unknown>;
  /**
   * How to write it. Default "upsert" (whole rows). Group and member rows can't be upserted under
   * their RLS rules, so they use "insert" (new named member) or "update" (partial changes).
   * "create" inserts only if the row doesn't exist yet (repeating group expenses: a month another
   * member already added, or deleted, is left as it is).
   */
  op?: "upsert" | "insert" | "update" | "create";
  /** Bumped each time a newer change is merged in, so a push never deletes a change it didn't send. */
  version?: number;
};

type Meta = { key: string; value: unknown };

/**
 * On-device copy of the user's data (IndexedDB). The UI reads from here, so it works offline
 * and renders instantly; `outbox` holds local changes not yet pushed to Supabase.
 * One database per user, deleted on sign-out.
 */
export class LocalDB extends Dexie {
  expenses!: EntityTable<Expense, "id">;
  categories!: EntityTable<Category, "id">;
  payment_methods!: EntityTable<PaymentMethod, "id">;
  profiles!: EntityTable<Profile, "id">;
  budgets!: EntityTable<Budget, "id">;
  recurring_rules!: EntityTable<RecurringRule, "id">;
  groups!: EntityTable<Group, "id">;
  group_members!: EntityTable<GroupMember, "id">;
  group_expenses!: EntityTable<GroupExpense, "id">;
  settlements!: EntityTable<Settlement, "id">;
  favourites!: EntityTable<Favourite, "id">;
  group_recurring_rules!: EntityTable<GroupRecurringRule, "id">;
  outbox!: EntityTable<OutboxItem, "seq">;
  meta!: EntityTable<Meta, "key">;

  constructor(readonly userId: string) {
    super(dbName(userId));
    this.version(1).stores({
      expenses: "id, spent_on, category_id",
      categories: "id",
      payment_methods: "id",
      profiles: "id",
      outbox: "++seq, rowId",
      meta: "key",
    });
    this.version(2).stores({ budgets: "id", recurring_rules: "id" });
    this.version(3).stores({
      groups: "id",
      group_members: "id, group_id",
      group_expenses: "id, group_id",
      settlements: "id, group_id",
    });
    this.version(4).stores({ favourites: "id", group_recurring_rules: "id, group_id" });
  }
}

const dbName = (userId: string) => `expense-${userId}`;

let current: LocalDB | null = null;

export function openLocalDB(userId: string): LocalDB {
  if (current?.userId !== userId) {
    current?.close();
    current = new LocalDB(userId);
  }
  return current;
}

export async function deleteLocalDB(userId: string) {
  if (current?.userId === userId) {
    current.close();
    current = null;
  }
  await Dexie.delete(dbName(userId));
}
