import { addDays, addMonths } from "./dates";

export type Frequency = "weekly" | "monthly" | "yearly";

type Schedule = { frequency: string; interval: number; anchor_date: string };

/** The k-th occurrence (k = 0 is the anchor). Months are counted from the anchor, so Jan 31 → Feb 28 → Mar 31. */
export function occurrence(rule: Schedule, k: number): string {
  if (rule.frequency === "weekly") return addDays(rule.anchor_date, 7 * rule.interval * k);
  if (rule.frequency === "yearly") return addMonths(rule.anchor_date, 12 * rule.interval * k);
  return addMonths(rule.anchor_date, rule.interval * k);
}

/** First occurrence strictly after `date`. */
export function occurrenceAfter(rule: Schedule, date: string): string {
  for (let k = 1; k < 5000; k++) {
    const next = occurrence(rule, k);
    if (next > date) return next;
  }
  throw new Error("Recurrence out of range");
}

/** Occurrences from `rule.next_due_on` with from <= date < to. */
export function occurrencesBetween(rule: Schedule & { next_due_on: string }, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = rule.next_due_on; date < to && dates.length < 400; date = occurrenceAfter(rule, date)) {
    if (date >= from) dates.push(date);
  }
  return dates;
}

/** Average cost per month, for "subscriptions cost ₹X/month". */
export function monthlyCost(rule: { frequency: string; interval: number; amount_minor: number }): number {
  if (rule.frequency === "weekly") return (rule.amount_minor * 52) / 12 / rule.interval;
  if (rule.frequency === "yearly") return rule.amount_minor / 12 / rule.interval;
  return rule.amount_minor / rule.interval;
}

const UNIT: Record<string, [string, string]> = {
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

export function describeFrequency(frequency: string, interval = 1): string {
  const [one, many] = UNIT[frequency] ?? UNIT.monthly;
  return interval === 1 ? `Every ${one}` : `Every ${interval} ${many}`;
}
