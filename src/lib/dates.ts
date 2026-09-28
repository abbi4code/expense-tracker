// Calendar dates are "YYYY-MM-DD" strings in the user's local calendar (never timestamps),
// so an expense logged at 11pm doesn't jump to another day. Math is done in UTC to avoid DST.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** Adds months, clamping the day (Jan 31 + 1 month = Feb 28). */
export function addMonths(iso: string, months: number): string {
  const date = parse(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return format(date);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parse(toISO).getTime() - parse(fromISO).getTime()) / 86_400_000);
}

export type Period = {
  /** Inclusive start date. */
  start: string;
  /** Exclusive end date. */
  end: string;
  label: string;
  shortLabel: string;
};

/**
 * The budgeting "month" containing `iso`. With monthStartDay = 25, Sep 30 falls in the
 * period Sep 25 – Oct 24 (useful when salary arrives on the 25th).
 */
export function periodContaining(iso: string, monthStartDay = 1): Period {
  const date = parse(iso);
  const year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  if (date.getUTCDate() < monthStartDay) month -= 1;
  const start = format(new Date(Date.UTC(year, month, monthStartDay)));
  const end = addMonths(start, 1);
  return { start, end, ...periodLabels(start, end, monthStartDay) };
}

export function shiftPeriod(period: Period, months: number, monthStartDay = 1): Period {
  return periodContaining(addMonths(period.start, months), monthStartDay);
}

function periodLabels(start: string, end: string, monthStartDay: number) {
  const startDate = parse(start);
  if (monthStartDay === 1) {
    const sameYear = startDate.getUTCFullYear() === new Date().getFullYear();
    return {
      label: startDate.toLocaleDateString(undefined, {
        month: "long",
        year: sameYear ? undefined : "numeric",
        timeZone: "UTC",
      }),
      shortLabel: startDate.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" }),
    };
  }
  const last = parse(addDays(end, -1));
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  const label = `${fmt(startDate)} – ${fmt(last)}`;
  return { label, shortLabel: label };
}

/** "Today", "Yesterday", "Mon, 21 Sep", or with year when not this year. */
export function relativeDayLabel(iso: string, today = todayISO()): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  const date = parse(iso);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}
