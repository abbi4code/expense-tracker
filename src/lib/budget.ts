import { daysBetween } from "./dates";
import type { RecurringRule } from "./db/local";
import { kindOf } from "./db/local";
import { occurrencesBetween } from "./recurrence";

export type BudgetStatus = "ok" | "close" | "over";

/** Calm three-step status: under 80% is fine, 80–100% is close, beyond is over. */
export function budgetStatus(spent: number, budget: number): BudgetStatus {
  const ratio = spent / budget;
  return ratio > 1 ? "over" : ratio >= 0.8 ? "close" : "ok";
}

/** Recurring expenses still to come in [from, to): rules' next occurrences not yet added. */
export function upcomingRecurringTotal(rules: RecurringRule[], from: string, to: string): number {
  let total = 0;
  for (const rule of rules) {
    if (!rule.is_active || rule.deleted_at || kindOf(rule) !== "expense") continue;
    total += occurrencesBetween(rule, from, to).length * rule.amount_minor;
  }
  return total;
}

export type SafeToSpend = { perDay: number; remaining: number; upcoming: number; daysLeft: number };

/** (budget − spent − bills still due this period) ÷ days left, including today. */
export function safeToSpend(
  budget: number,
  spent: number,
  rules: RecurringRule[],
  period: { start: string; end: string },
  today: string,
): SafeToSpend {
  const upcoming = upcomingRecurringTotal(rules, period.start, period.end);
  const remaining = budget - spent - upcoming;
  const daysLeft = Math.max(1, daysBetween(today, period.end));
  return { perDay: Math.max(0, Math.floor(remaining / daysLeft)), remaining, upcoming, daysLeft };
}
