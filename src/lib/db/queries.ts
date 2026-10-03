"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useData } from "@/components/data/data-provider";
import { addDays, todayISO } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { favouriteSuggestions } from "@/lib/favourites";
import { memberBalances, simplifyDebts } from "@/lib/splits";
import { countsAsSpending, kindOf, type Category, type Expense, type Kind } from "./local";

// Live queries over the on-device DB: components re-render whenever the data changes.
// `undefined` means "still loading".

const byOrder = <T extends { sort_order: number; created_at: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/** Newest first: by day, then by time logged. */
export const byNewest = (a: Expense, b: Expense) =>
  b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at);

export function useProfile() {
  const { db } = useData();
  return useLiveQuery(() => db.profiles.get(db.userId), [db]);
}

export function useInitialSyncDone() {
  const { db } = useData();
  return useLiveQuery(async () => Boolean((await db.meta.get("initialSyncDone"))?.value), [db]);
}

/** Non-deleted categories of one kind (including ones hidden from the Add sheet), in the user's order. */
export function useCategories(kind: Kind = "expense") {
  const { db } = useData();
  return useLiveQuery(
    async () => (await db.categories.toArray()).filter((c) => !c.deleted_at && kindOf(c) === kind).sort(byOrder),
    [db, kind],
  );
}

/** id → category, including deleted ones so old expenses still render. */
export function useCategoryMap() {
  const { db } = useData();
  const all = useLiveQuery(() => db.categories.toArray(), [db]);
  return useMemo(() => new Map((all ?? []).map((c) => [c.id, c] as const)), [all]);
}

export function usePaymentMethods() {
  const { db } = useData();
  return useLiveQuery(
    async () => (await db.payment_methods.toArray()).filter((m) => !m.deleted_at).sort(byOrder),
    [db],
  );
}

export function usePaymentMethodMap() {
  const { db } = useData();
  const all = useLiveQuery(() => db.payment_methods.toArray(), [db]);
  return useMemo(() => new Map((all ?? []).map((m) => [m.id, m] as const)), [all]);
}

/**
 * Non-deleted entries with start <= spent_on < end, newest first. "expense" means personal
 * spending (reimbursable work costs excluded); "all" includes income and reimbursables.
 */
export function useExpensesBetween(start: string, end: string, kind: Kind | "all" = "expense") {
  const { db } = useData();
  return useLiveQuery(
    async () =>
      (await db.expenses.where("spent_on").between(start, end, true, false).toArray())
        .filter(
          (e) => !e.deleted_at && (kind === "all" || (kind === "expense" ? countsAsSpending(e) : kindOf(e) === kind)),
        )
        .sort(byNewest),
    [db, start, end, kind],
  );
}

export function useRecentExpenses(limit: number, kind: Kind = "expense") {
  const { db } = useData();
  return useLiveQuery(async () => {
    const candidates = await db.expenses
      .orderBy("spent_on")
      .reverse()
      .filter((e) => !e.deleted_at && kindOf(e) === kind)
      .limit(limit * 3)
      .toArray();
    return candidates.sort(byNewest).slice(0, limit);
  }, [db, limit, kind]);
}

export function useExpenseCount() {
  const { db } = useData();
  return useLiveQuery(() => db.expenses.filter((e) => !e.deleted_at).count(), [db]);
}

/** Pinned favourites in the user's order. */
export function useFavourites() {
  const { db } = useData();
  return useLiveQuery(async () => (await db.favourites.toArray()).filter((f) => !f.deleted_at).sort(byOrder), [db]);
}

/** Repeat spends from the last 90 days worth pinning (not pinned yet). */
export function useFavouriteSuggestions() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const since = addDays(todayISO(), -90);
    const [recent, pinned] = await Promise.all([
      db.expenses.where("spent_on").aboveOrEqual(since).toArray(),
      db.favourites.toArray(),
    ]);
    return favouriteSuggestions(recent, pinned);
  }, [db]);
}

export type CategoryUsage = { count: number; lastUsed: string };

/** How often each category was used in the last 90 days: drives chip order in the Add sheet. */
export function useCategoryUsage() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const since = addDays(todayISO(), -90);
    const recent = await db.expenses.where("spent_on").aboveOrEqual(since).toArray();
    const usage = new Map<string, CategoryUsage>();
    for (const e of recent) {
      if (e.deleted_at) continue;
      const current = usage.get(e.category_id);
      const stamp = `${e.spent_on}T${e.created_at}`;
      usage.set(e.category_id, {
        count: (current?.count ?? 0) + 1,
        lastUsed: current && current.lastUsed > stamp ? current.lastUsed : stamp,
      });
    }
    return usage;
  }, [db]);
}

/** Most recent note → category, to suggest a category as the user types a familiar note. */
export function useNoteSuggestions() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const withNotes = (await db.expenses.filter((e) => !e.deleted_at && !!e.note).toArray()).sort(byNewest);
    const map = new Map<string, string>();
    for (const e of withNotes) {
      const key = e.note!.trim().toLowerCase();
      if (!map.has(key)) map.set(key, e.category_id);
    }
    return map;
  }, [db]);
}

export function usePendingChanges() {
  const { db } = useData();
  return useLiveQuery(() => db.outbox.count(), [db]);
}

export function sumMinor(expenses: Expense[]) {
  return expenses.reduce((total, e) => total + e.amount_minor, 0);
}

export type CategoryTotal = { category: Category | undefined; categoryId: string; total: number; count: number };

export function totalsByCategory(expenses: Expense[], categories: Map<string, Category>): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const e of expenses) {
    const entry = totals.get(e.category_id) ?? {
      category: categories.get(e.category_id),
      categoryId: e.category_id,
      total: 0,
      count: 0,
    };
    entry.total += e.amount_minor;
    entry.count += 1;
    totals.set(e.category_id, entry);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Phase 2: budgets, recurring rules, search
// ---------------------------------------------------------------------------

/** Active budgets keyed by category id ("overall" for the monthly total). */
export function useBudgets() {
  const { db } = useData();
  const budgets = useLiveQuery(() => db.budgets.toArray(), [db]);
  return useMemo(() => {
    if (!budgets) return undefined;
    const map = new Map<string, number>();
    for (const b of budgets) if (!b.deleted_at) map.set(b.category_id ?? "overall", b.amount_minor);
    return map;
  }, [budgets]);
}

export function useRecurringRules() {
  const { db } = useData();
  return useLiveQuery(
    async () =>
      (await db.recurring_rules.toArray())
        .filter((r) => !r.deleted_at)
        .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
    [db],
  );
}

export type SearchFilters = { query: string; categoryId?: string | null; paymentMethodId?: string | null };

/**
 * Searches all time: notes, #tags, category names and amounts.
 * ">500" / "<100" filter by amount (in major units); "#goa" matches a tag exactly.
 */
export function useSearch({ query, categoryId, paymentMethodId }: SearchFilters) {
  const { db } = useData();
  return useLiveQuery(async () => {
    const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c.name.toLowerCase()] as const));
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (e: Expense) => {
      if (categoryId && e.category_id !== categoryId) return false;
      if (paymentMethodId && e.payment_method_id !== paymentMethodId) return false;
      return terms.every((term) => {
        const comparison = term.match(/^([<>])=?(\d+(?:\.\d+)?)$/);
        const major = fromMinor(e.amount_minor, e.currency);
        if (comparison) return comparison[1] === ">" ? major >= Number(comparison[2]) : major <= Number(comparison[2]);
        if (term.startsWith("#")) return (e.tags ?? []).includes(term.slice(1));
        return (
          (e.note ?? "").toLowerCase().includes(term) ||
          (categories.get(e.category_id) ?? "").includes(term) ||
          String(major).startsWith(term)
        );
      });
    };
    return (await db.expenses.filter((e) => !e.deleted_at && matches(e)).toArray()).sort(byNewest).slice(0, 300);
  }, [db, query, categoryId, paymentMethodId]);
}

/** Totals per #tag across all time, biggest first. */
export function useTagTotals() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const totals = new Map<string, { total: number; count: number }>();
    await db.expenses.each((e) => {
      if (e.deleted_at || kindOf(e) !== "expense") return;
      for (const tag of e.tags ?? []) {
        const entry = totals.get(tag) ?? { total: 0, count: 0 };
        entry.total += e.amount_minor;
        entry.count += 1;
        totals.set(tag, entry);
      }
    });
    return [...totals].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => b.total - a.total);
  }, [db]);
}

/** Reimbursable expenses not yet paid back, newest first. */
export function useOwedBack() {
  const { db } = useData();
  return useLiveQuery(
    async () =>
      (await db.expenses.filter((e) => !e.deleted_at && !!e.reimbursable && !e.reimbursed_at).toArray()).sort(byNewest),
    [db],
  );
}

/** Days in a row (ending today, or yesterday if nothing yet today) with at least one entry. */
export function useStreak() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const today = todayISO();
    const days = new Set<string>();
    await db.expenses
      .where("spent_on")
      .aboveOrEqual(addDays(today, -400))
      .each((e) => {
        if (!e.deleted_at) days.add(e.spent_on);
      });
    let day = days.has(today) ? today : addDays(today, -1);
    let streak = 0;
    while (days.has(day)) {
      streak += 1;
      day = addDays(day, -1);
    }
    return { streak, loggedToday: days.has(today) };
  }, [db]);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** Your groups with your balance in each (positive = you're owed). */
export function useGroupsOverview() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const [groups, members, expenses, settlements] = await Promise.all([
      db.groups.toArray(),
      db.group_members.toArray(),
      db.group_expenses.toArray(),
      db.settlements.toArray(),
    ]);
    return groups
      .filter((g) => !g.deleted_at)
      .map((group) => {
        const groupMembers = members.filter((m) => m.group_id === group.id && !m.deleted_at);
        const me = groupMembers.find((m) => m.user_id === db.userId);
        const balances = memberBalances(
          expenses.filter((e) => e.group_id === group.id),
          settlements.filter((s) => s.group_id === group.id),
        );
        const lastActivity = expenses
          .filter((e) => e.group_id === group.id && !e.deleted_at)
          .reduce((latest, e) => (e.created_at > latest ? e.created_at : latest), group.created_at);
        return {
          group,
          memberCount: groupMembers.length,
          myBalance: me ? (balances.get(me.id) ?? 0) : 0,
          lastActivity,
        };
      })
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  }, [db]);
}

/** Everything a group screen needs, computed from the on-device copy. */
export function useGroupDetail(groupId: string) {
  const { db } = useData();
  return useLiveQuery(async () => {
    const group = await db.groups.get(groupId);
    if (!group) return null;
    const [members, expenses, settlements, rules] = await Promise.all([
      db.group_members.where("group_id").equals(groupId).toArray(),
      db.group_expenses.where("group_id").equals(groupId).toArray(),
      db.settlements.where("group_id").equals(groupId).toArray(),
      db.group_recurring_rules.where("group_id").equals(groupId).toArray(),
    ]);
    const balances = memberBalances(expenses, settlements);
    const byNewestDay = <T extends { spent_on: string; created_at: string }>(a: T, b: T) =>
      b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at);
    return {
      group,
      // Everyone who ever took part (names for old expenses); `active` for pickers.
      // Members added together share a timestamp, so break ties by role and name for a stable order.
      members: members.sort(
        (a, b) =>
          Number(b.role === "owner") - Number(a.role === "owner") ||
          a.created_at.localeCompare(b.created_at) ||
          a.display_name.localeCompare(b.display_name),
      ),
      active: members.filter((m) => !m.deleted_at),
      me: members.find((m) => m.user_id === db.userId && !m.deleted_at) ?? null,
      expenses: expenses.filter((e) => !e.deleted_at).sort(byNewestDay),
      settlements: settlements.filter((s) => !s.deleted_at).sort(byNewestDay),
      balances,
      transfers: simplifyDebts(balances),
      // Repeating expenses (rent…), paused ones included, next due first.
      rules: rules.filter((r) => !r.deleted_at).sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
    };
  }, [db, groupId]);
}
