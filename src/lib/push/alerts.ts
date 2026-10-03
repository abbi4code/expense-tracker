import { daysBetween, type Period } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { memberBalances, simplifyDebts } from "@/lib/splits";
import type { PushMessage } from "./server";

// Pure decisions for budget alerts and settle-up reminders (the scheduler does the I/O).

/** Budget alerts only while people are awake. */
export const BUDGET_ALERT_HOURS = { from: 9, to: 21 };
export const SETTLE_HOUR = 10;
export const SETTLE_AFTER_DAYS = 14;

export type Alert = { key: string; message: PushMessage };

type BudgetRow = { id: string; category_id: string | null; amount_minor: number };
type CategoryRow = { id: string; name: string; emoji: string };

/**
 * One alert per budget when it reaches 80% and again at 100%, each once per period (the key
 * includes the period start). Jumping straight past 100% sends only the "over" alert.
 * `sent` holds keys already in the notification log.
 */
export function budgetAlerts(input: {
  budgets: BudgetRow[];
  /** Personal spending this period by category id. */
  spentByCategory: Map<string, number>;
  categories: CategoryRow[];
  period: Period;
  today: string;
  currency: string;
  sent: Set<string>;
}): Alert[] {
  const { budgets, spentByCategory, categories, period, today, currency, sent } = input;
  const total = [...spentByCategory.values()].reduce((sum, v) => sum + v, 0);
  const daysLeft = Math.max(1, daysBetween(today, period.end));
  const alerts: Alert[] = [];

  for (const budget of budgets) {
    const spent = budget.category_id ? (spentByCategory.get(budget.category_id) ?? 0) : total;
    const ratio = spent / budget.amount_minor;
    if (ratio < 0.8) continue;
    const key = (level: string) => `${budget.id}:${period.start}:${level}`;
    if (sent.has(key("100"))) continue;
    const level = ratio >= 1 ? "100" : "80";
    if (sent.has(key(level))) continue;

    const category = categories.find((c) => c.id === budget.category_id);
    const name = category ? `${category.emoji} ${category.name}` : null;
    const money = (minor: number) => formatMoney(minor, currency);
    const days = `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
    let message: PushMessage;
    if (level === "80") {
      message = {
        title: name
          ? `${name} is at ${Math.floor(ratio * 100)}% of its budget`
          : `You've used ${Math.floor(ratio * 100)}% of your budget`,
        body: `${money(budget.amount_minor - spent)} left of ${money(budget.amount_minor)} for the next ${days}.`,
        url: "/home",
        tag: `budget:${budget.id}`,
      };
    } else if (spent === budget.amount_minor) {
      message = {
        title: name ? `${name} budget used up` : "Monthly budget used up",
        body: `You've spent all ${money(budget.amount_minor)}, with ${days} to go.`,
        url: "/home",
        tag: `budget:${budget.id}`,
      };
    } else {
      message = {
        title: name ? `Over your ${name} budget` : "Over your monthly budget",
        body: `${money(spent - budget.amount_minor)} over ${money(budget.amount_minor)}, with ${days} to go.`,
        url: "/home",
        tag: `budget:${budget.id}`,
      };
    }
    alerts.push({ key: key(level), message });
  }
  return alerts;
}

type Movement = { created_at: string; deleted_at?: string | null };
type GroupExpenseRow = Movement & { paid_by_member_id: string; amount_minor: number; splits: unknown };
type SettlementRow = Movement & { from_member_id: string; to_member_id: string; amount_minor: number };

/**
 * When `memberIds` (your spots in a group: more than one if you left and rejoined) started owing,
 * replaying expenses and payments in the order they were logged. Null when you don't owe now.
 */
export function owingSince(expenses: GroupExpenseRow[], settlements: SettlementRow[], memberIds: Set<string>) {
  const events = [
    ...expenses.filter((e) => !e.deleted_at).map((e) => ({ at: e.created_at, expenses: [e], settlements: [] })),
    ...settlements.filter((s) => !s.deleted_at).map((s) => ({ at: s.created_at, expenses: [], settlements: [s] })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let balance = 0;
  let since: string | null = null;
  for (const event of events) {
    const change = memberBalances(event.expenses, event.settlements);
    const before = balance;
    for (const id of memberIds) balance += change.get(id) ?? 0;
    if (before >= 0 && balance < 0) since = event.at;
    if (balance >= 0) since = null;
  }
  return balance < 0 ? since : null;
}

/**
 * "You've owed Rahul ₹600 in Flat 4B for 2 weeks": once you've owed for 14 days, then at most once
 * a week (the key holds the week number since you started owing).
 */
export function settleReminder(input: {
  group: { id: string; name: string; emoji: string };
  members: { id: string; display_name: string }[];
  memberIds: Set<string>;
  expenses: GroupExpenseRow[];
  settlements: SettlementRow[];
  currency: string;
  now: Date;
  sent: Set<string>;
}): Alert | null {
  const { group, members, memberIds, expenses, settlements, currency, now, sent } = input;
  const since = owingSince(expenses, settlements, memberIds);
  if (!since) return null;
  const days = Math.floor((now.getTime() - Date.parse(since)) / 86_400_000);
  if (days < SETTLE_AFTER_DAYS) return null;
  const key = `${group.id}:${since}:${Math.floor(days / 7)}`;
  if (sent.has(key)) return null;

  const transfers = simplifyDebts(memberBalances(expenses, settlements)).filter((t) => memberIds.has(t.from));
  if (!transfers.length) return null;
  const owed = transfers.reduce((sum, t) => sum + t.amount, 0);
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "someone";
  const weeks = Math.floor(days / 7);
  const whom = transfers.length === 1 ? name(transfers[0].to) : `${transfers.length} people`;
  return {
    key,
    message: {
      title: `${group.emoji} ${group.name}`,
      body: `Just a nudge: you've owed ${whom} ${formatMoney(owed, currency)} for ${weeks} weeks. Tap to settle up.`,
      url: `/groups/${group.id}`,
      tag: `settle:${group.id}`,
    },
  };
}
