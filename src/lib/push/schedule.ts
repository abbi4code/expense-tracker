import { addDays } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PushMessage } from "./server";

// Pure scheduling decisions, kept apart from I/O so they're easy to reason about and test.

export const BILLS_HOUR = 9;
export const RECAP_HOUR = 19;

export type LocalTime = { date: string; hour: number; weekday: number };

/** The user's wall-clock date/hour/weekday in their time zone. */
export function localTime(now: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

export function validTimeZone(timeZone: string | null | undefined): string {
  try {
    if (timeZone) {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return timeZone;
    }
  } catch {}
  return "UTC";
}

export function dailyReminder(): PushMessage {
  return {
    title: "Log today's spending?",
    body: "Nothing logged yet today. It takes 3 seconds.",
    url: "/home?add=1",
    tag: "daily",
  };
}

type DueRule = { note: string | null; category: string; amount_minor: number; currency: string; next_due_on: string };

export function billsReminder(rules: DueRule[], today: string): PushMessage | null {
  if (!rules.length) return null;
  const tomorrow = addDays(today, 1);
  const lines = rules
    .slice(0, 4)
    .map((r) =>
      `${r.note || r.category} ${formatMoney(r.amount_minor, r.currency)} ${r.next_due_on <= today ? "today" : r.next_due_on === tomorrow ? "tomorrow" : ""}`.trim(),
    );
  const more = rules.length > 4 ? ` +${rules.length - 4} more` : "";
  return {
    title: rules.length === 1 ? "Bill coming up" : `${rules.length} bills coming up`,
    body: lines.join(" · ") + more,
    url: "/home",
    tag: "bills",
  };
}

type GroupActivity = {
  groupName: string;
  items: { who: string; description: string; amount: string; yourShare: string | null }[];
};

/** "Rahul added Dinner ₹2,400 in Goa Trip · your share ₹600", or a count when there are several. */
export function groupActivity({ groupName, items }: GroupActivity): PushMessage {
  if (items.length === 1) {
    const [item] = items;
    return {
      title: groupName,
      body: `${item.who} added ${item.description} ${item.amount}${item.yourShare ? ` · your share ${item.yourShare}` : ""}`,
      url: "/groups",
      tag: `group:${groupName}`,
    };
  }
  return {
    title: groupName,
    body: `${items.length} new expenses: ${items
      .map((i) => i.description)
      .slice(0, 3)
      .join(", ")}${items.length > 3 ? "…" : ""}`,
    url: "/groups",
    tag: `group:${groupName}`,
  };
}

export function weeklyRecap(thisWeek: number, lastWeek: number, currency: string): PushMessage | null {
  if (thisWeek === 0 && lastWeek === 0) return null;
  let comparison = "";
  if (lastWeek > 0) {
    const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    comparison =
      change === 0 ? ", same as last week" : `, ${Math.abs(change)}% ${change < 0 ? "less" : "more"} than last week`;
  }
  return {
    title: "Your week in spending",
    body: `You spent ${formatMoney(thisWeek, currency)} this week${comparison}.`,
    url: "/insights",
    tag: "weekly",
  };
}
