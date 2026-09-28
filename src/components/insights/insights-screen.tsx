"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PeriodSwitcher } from "@/components/app/period-switcher";
import { SyncStatus } from "@/components/app/sync-status";
import { ExpenseList } from "@/components/expenses/expense-list";
import { BudgetBar, BudgetLabel } from "@/components/ui/budget-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryStyle } from "@/lib/category-colors";
import { addDays, daysBetween, shiftPeriod, todayISO, type Period } from "@/lib/dates";
import type { Expense } from "@/lib/db/local";
import {
  sumMinor,
  totalsByCategory,
  useBudgets,
  useCategoryMap,
  useExpensesBetween,
  useTagTotals,
} from "@/lib/db/queries";
import { heroTextClass } from "@/lib/hero-size";
import { formatMoney } from "@/lib/money";
import { useCurrentPeriod } from "@/lib/use-period";
import { cn } from "@/lib/utils";
import { ColumnChart } from "./column-chart";

const TREND_PERIODS = 6;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function InsightsScreen() {
  const { period: current, monthStartDay, profile } = useCurrentPeriod();
  const [offset, setOffset] = useState(0);
  const period = offset === 0 ? current : shiftPeriod(current, offset, monthStartDay);
  const today = todayISO();
  const currency = profile?.currency ?? "INR";
  const money = (value: number) => formatMoney(value, currency);

  // One query covers the trend window; everything else is derived from it.
  const trendPeriods = useMemo(
    () => Array.from({ length: TREND_PERIODS }, (_, i) => shiftPeriod(period, i - (TREND_PERIODS - 1), monthStartDay)),
    [period, monthStartDay],
  );
  const windowExpenses = useExpensesBetween(trendPeriods[0].start, period.end);
  const categories = useCategoryMap();
  const budgets = useBudgets();
  const tags = useTagTotals();
  const weekdaySource = useExpensesBetween(addDays(today, -90), addDays(today, 1));

  const expenses = useMemo(() => inPeriod(windowExpenses, period), [windowExpenses, period]);
  const previous = useMemo(
    () => inPeriod(windowExpenses, trendPeriods[TREND_PERIODS - 2]),
    [windowExpenses, trendPeriods],
  );
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (!expenses) {
    return (
      <Shell period={period} offset={offset} setOffset={setOffset}>
        <Skeleton className="mt-5 h-64" />
      </Shell>
    );
  }

  const total = sumMinor(expenses);
  const rows = totalsByCategory(expenses, categories);
  const max = rows[0]?.total ?? 0;
  // Days so far in the current period; the full length for past ones.
  const days = offset === 0 ? daysBetween(period.start, today) + 1 : daysBetween(period.start, period.end);
  const top = rows[0];
  const overall = budgets?.get("overall");

  const trend = trendPeriods.map((p) => ({
    key: p.start,
    label: shortMonth(p.start),
    fullLabel: p.label,
    value: sumMinor(inPeriod(windowExpenses, p) ?? []),
  }));

  const changes = categoryChanges(expenses, previous ?? [], categories);

  const weekdayTotals = WEEKDAYS.map((_, day) =>
    sumMinor((weekdaySource ?? []).filter((e) => new Date(`${e.spent_on}T12:00:00`).getDay() === day)),
  );
  const busiest = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const weekdayColumns = WEEKDAYS.map((label, day) => ({
    key: String(day),
    label: label.slice(0, 1),
    fullLabel: WEEKDAY_NAMES[day],
    value: weekdayTotals[day],
  }));

  const biggest = [...expenses].sort((a, b) => b.amount_minor - a.amount_minor).slice(0, 5);

  return (
    <Shell period={period} offset={offset} setOffset={setOffset}>
      {expenses.length === 0 ? (
        <EmptyState
          emoji="📊"
          title="No spending in this period"
          description="Log a few expenses and you'll see where your money goes."
        />
      ) : (
        <>
          <Card className="mt-5 p-6">
            <p className="text-sm font-medium text-muted">Total spent</p>
            <p
              className={cn(
                "mt-1 leading-none font-semibold tracking-tighter tabular-nums",
                heroTextClass(money(total)),
              )}
            >
              {money(total)}
            </p>
            {top && (
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                <span className="font-medium text-ink">
                  {top.category?.emoji} {top.category?.name ?? "Other"}
                </span>{" "}
                was {Math.round((top.total / total) * 100)}% of your spending.
              </p>
            )}
            {overall && <BudgetBar spent={total} budget={overall} currency={currency} className="mt-4" />}
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Daily average" value={money(Math.round(total / Math.max(days, 1)))} />
              <Stat label="Expenses" value={String(expenses.length)} />
            </dl>
          </Card>

          <Section title="Last 6 months" subtitle={trendTakeaway(trend, money)}>
            <ColumnChart
              columns={trend}
              selectedKey={selectedTrend ?? period.start}
              onSelect={setSelectedTrend}
              format={money}
            />
          </Section>

          {changes.length > 0 && (
            <Section title="What changed" subtitle={`Compared with ${trendPeriods[TREND_PERIODS - 2].label}`}>
              <ul className="space-y-2.5">
                {changes.map(({ categoryId, name, emoji, diff }) => {
                  const up = diff > 0;
                  const Icon = up ? ArrowUpRight : ArrowDownRight;
                  return (
                    <li key={categoryId} className="flex items-center gap-2.5 text-[15px]">
                      <Icon className={cn("size-4 shrink-0", up ? "text-muted" : "text-success")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {emoji} {name}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {up ? "+" : "−"}
                        {money(Math.abs(diff))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title="By category">
            <ul className="space-y-1">
              {rows.map(({ categoryId, category, total: amount, count }) => {
                const budget = budgets?.get(categoryId);
                return (
                  <li key={categoryId}>
                    <Link
                      href={`/activity?category=${categoryId}${offset === 0 ? "" : `&month=${period.start}`}`}
                      className="block rounded-2xl px-1 py-2.5 transition active:bg-surface-2"
                    >
                      <div className="flex items-baseline gap-2 text-[15px]">
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {category?.emoji} {category?.name ?? "Other"}
                        </span>
                        <span className="text-sm text-subtle tabular-nums">
                          {count} · {Math.round((amount / total) * 100)}%
                        </span>
                        <span className="font-semibold tabular-nums">{money(amount)}</span>
                      </div>
                      {/* Thin bar from a shared baseline; the label above carries identity. */}
                      <div className="mt-2 h-2 rounded-r bg-surface-2">
                        <div
                          style={{ ...categoryStyle(category?.color ?? "slate"), width: `${(amount / max) * 100}%` }}
                          className="cat-fill h-full min-w-1 rounded-r"
                        />
                      </div>
                      {budget && <BudgetLabel spent={amount} budget={budget} currency={currency} className="mt-1.5" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>

          {weekdayTotals.some((v) => v > 0) && (
            <Section title="By weekday" subtitle={`Last 90 days. You spend the most on ${WEEKDAY_NAMES[busiest]}s.`}>
              <ColumnChart
                columns={weekdayColumns}
                selectedKey={selectedDay ?? String(busiest)}
                onSelect={setSelectedDay}
                format={money}
                height={96}
              />
            </Section>
          )}

          <Section title="Biggest expenses">
            <ExpenseList expenses={biggest} currency={currency} groupByDay={false} />
          </Section>

          {tags && tags.length > 0 && (
            <Section title="Tags" subtitle="All time">
              <ul className="flex flex-wrap gap-2">
                {tags.slice(0, 12).map(({ tag, total: amount, count }) => (
                  <li key={tag}>
                    <Link
                      href={`/activity?q=${encodeURIComponent(`#${tag}`)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm"
                    >
                      <span className="font-medium">#{tag}</span>
                      <span className="text-muted tabular-nums">
                        {money(amount)} · {count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({
  period,
  offset,
  setOffset,
  children,
}: {
  period: Period;
  offset: number;
  setOffset: (update: (o: number) => number) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex h-16 items-center justify-between pt-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Insights</h1>
        <SyncStatus />
      </header>
      <PeriodSwitcher
        period={period}
        onPrevious={() => setOffset((o) => o - 1)}
        onNext={() => setOffset((o) => Math.min(0, o + 1))}
        canGoNext={offset < 0}
      />
      {children}
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {subtitle && <p className="mt-1 px-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function inPeriod(expenses: Expense[] | undefined, period: { start: string; end: string }) {
  return expenses?.filter((e) => e.spent_on >= period.start && e.spent_on < period.end);
}

function shortMonth(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
}

function trendTakeaway(trend: { value: number; fullLabel: string }[], money: (v: number) => string) {
  const past = trend.slice(0, -1).filter((t) => t.value > 0);
  if (!past.length) return undefined;
  const average = Math.round(past.reduce((sum, t) => sum + t.value, 0) / past.length);
  return `You usually spend about ${money(average)} a month.`;
}

type Change = { categoryId: string; name: string; emoji: string; diff: number };

/** Biggest category moves vs the previous period (up to 4, largest first). */
function categoryChanges(
  current: Expense[],
  previous: Expense[],
  categories: Map<string, { name: string; emoji: string }>,
): Change[] {
  if (!previous.length) return [];
  const diffs = new Map<string, number>();
  for (const e of current) diffs.set(e.category_id, (diffs.get(e.category_id) ?? 0) + e.amount_minor);
  for (const e of previous) diffs.set(e.category_id, (diffs.get(e.category_id) ?? 0) - e.amount_minor);
  return [...diffs]
    .filter(([, diff]) => diff !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([categoryId, diff]) => ({
      categoryId,
      diff,
      name: categories.get(categoryId)?.name ?? "Other",
      emoji: categories.get(categoryId)?.emoji ?? "💸",
    }));
}
