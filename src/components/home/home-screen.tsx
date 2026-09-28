"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { SyncStatus } from "@/components/app/sync-status";
import { ExpenseList } from "@/components/expenses/expense-list";
import { useExpenseSheet } from "@/components/expenses/expense-sheet";
import { BudgetBar } from "@/components/ui/budget-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { safeToSpend } from "@/lib/budget";
import { categoryStyle } from "@/lib/category-colors";
import { addDays, daysBetween, shiftPeriod, todayISO } from "@/lib/dates";
import {
  sumMinor,
  totalsByCategory,
  useBudgets,
  useCategoryMap,
  useExpensesBetween,
  useInitialSyncDone,
  useRecentExpenses,
  useRecurringRules,
} from "@/lib/db/queries";
import { heroTextClass } from "@/lib/hero-size";
import { floorToWhole, formatMoney } from "@/lib/money";
import { useLocalPreference } from "@/lib/use-local-preference";
import { useCurrentPeriod } from "@/lib/use-period";
import { cn } from "@/lib/utils";
import { StreakChip } from "@/components/app/streak-chip";
import { DueBills, UpcomingBills } from "./bills";
import { ClaimCard } from "./claim-card";
import { QuickAdd } from "./quick-add";
import { InstallCard } from "./install-card";

type HeroMode = "spent" | "safe";

export function HomeScreen() {
  const { period, monthStartDay, profile } = useCurrentPeriod();
  const today = todayISO();
  const expenses = useExpensesBetween(period.start, period.end);
  const income = useExpensesBetween(period.start, period.end, "income");
  const recent = useRecentExpenses(5);
  const categories = useCategoryMap();
  const budgets = useBudgets();
  const rules = useRecurringRules();
  const synced = useInitialSyncDone();
  const { openAdd } = useExpenseSheet();
  const [heroMode, setHeroMode] = useLocalPreference<HeroMode>("home-hero", "safe");

  // Same point in the previous period, for a fair "vs last month".
  const previous = shiftPeriod(period, -1, monthStartDay);
  const elapsedDays = daysBetween(period.start, today) + 1;
  const previousToDate = useExpensesBetween(previous.start, minISO(addDays(previous.start, elapsedDays), previous.end));

  const currency = profile?.currency ?? "INR";
  const firstName = profile?.display_name?.split(" ")[0];
  const loading = !profile || !expenses || !recent || (!synced && recent.length === 0);

  const total = sumMinor(expenses ?? []);
  const byCategory = totalsByCategory(expenses ?? [], categories);
  const budget = budgets?.get("overall");
  const safeRaw = budget ? safeToSpend(budget, total, rules ?? [], period, today) : null;
  const safe = safeRaw && { ...safeRaw, perDay: floorToWhole(safeRaw.perDay, currency) };
  const showSafe = heroMode === "safe" && safe !== null;

  return (
    <>
      <header className="flex h-16 items-center justify-between pt-2">
        <p className="text-[15px] font-medium text-muted">{firstName ? `Hi, ${firstName}` : "Hi there"} 👋</p>
        <div className="flex items-center gap-2">
          <StreakChip />
          <SyncStatus />
        </div>
      </header>

      <Card className="p-6">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => safe && setHeroMode(showSafe ? "spent" : "safe")}
          aria-label={safe ? `Showing ${showSafe ? "safe to spend" : "spent"}. Tap to switch.` : undefined}
        >
          <p className="flex items-center justify-between text-sm font-medium text-muted">
            <span>{showSafe ? "Safe to spend today" : `Spent in ${period.shortLabel}`}</span>
            {safe && <span className="text-xs text-subtle">Tap to switch</span>}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-14 w-48" />
          ) : (
            <p
              className={cn(
                "mt-1 leading-none font-semibold tracking-tighter tabular-nums",
                heroTextClass(formatMoney(showSafe ? safe.perDay : total, currency)),
              )}
            >
              {formatMoney(showSafe ? safe.perDay : total, currency)}
              {showSafe && <span className="ml-1 text-lg font-medium tracking-normal text-muted">/day</span>}
            </p>
          )}
        </button>

        {!loading && showSafe && (
          <p className="mt-2 text-sm text-muted">
            {safe.remaining > 0 ? (
              <>
                <span className="font-medium text-ink">{formatMoney(safe.remaining, currency)}</span> left for{" "}
                {safe.daysLeft} {safe.daysLeft === 1 ? "day" : "days"}
                {safe.upcoming > 0 && <> after {formatMoney(safe.upcoming, currency)} of bills</>}
              </>
            ) : (
              <>
                You have used this month<>Budget used up. Every rupee now goes over, so take it easy.</>apos;s budget.
                Anything more goes over.
              </>
            )}
          </p>
        )}
        {!loading && !showSafe && previousToDate && previousToDate.length > 0 && (
          <Comparison current={total} previous={sumMinor(previousToDate)} currency={currency} />
        )}

        {!loading && budget ? (
          <BudgetBar spent={total} budget={budget} currency={currency} className="mt-5" />
        ) : (
          !loading && (
            <Link
              href="/settings/budgets"
              className="mt-4 block text-sm font-medium text-ink underline underline-offset-4"
            >
              Set a monthly budget to see what you can spend each day
            </Link>
          )
        )}

        {profile?.track_income && income && (
          <p className="mt-4 flex justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="text-muted">
              Income <span className="font-medium text-ink">{formatMoney(sumMinor(income), currency)}</span>
            </span>
            <span className="text-muted">
              Saved{" "}
              <span className={cn("font-medium", sumMinor(income) - total >= 0 ? "text-success" : "text-ink")}>
                {formatMoney(sumMinor(income) - total, currency)}
              </span>
            </span>
          </p>
        )}

        {byCategory.length > 0 && (
          <>
            {/* Top 4 in their colours + one neutral "Other" segment, matching the legend below. */}
            <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {byCategory.slice(0, 4).map(({ categoryId, category, total: amount }) => (
                <span
                  key={categoryId}
                  style={{ ...categoryStyle(category?.color ?? "slate"), flexGrow: amount }}
                  className="cat-fill min-w-1"
                />
              ))}
              {byCategory.length > 4 && (
                <span style={{ flexGrow: sumOf(byCategory.slice(4)) }} className="min-w-1 bg-line" />
              )}
            </div>
            <ul className="mt-4 space-y-2.5">
              {byCategory.slice(0, 4).map(({ categoryId, category, total: amount }) => (
                <li key={categoryId}>
                  <Link href={`/activity?category=${categoryId}`} className="flex items-center gap-2.5 text-[15px]">
                    <span
                      style={categoryStyle(category?.color ?? "slate")}
                      className="cat-fill size-2.5 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {category?.emoji} {category?.name ?? "Other"}
                    </span>
                    <span className="hidden w-9 shrink-0 text-right text-sm text-subtle tabular-nums min-[360px]:inline">
                      {Math.round((amount / total) * 100)}%
                    </span>
                    <span className="shrink-0 text-right font-medium tabular-nums">
                      {formatMoney(amount, currency)}
                    </span>
                  </Link>
                </li>
              ))}
              {byCategory.length > 4 && (
                <li className="flex items-center gap-2.5 text-[15px] text-muted">
                  <span className="size-2.5 shrink-0 rounded-full bg-line" />
                  <span className="min-w-0 flex-1 truncate">{byCategory.length - 4} more</span>
                  <span className="hidden w-9 shrink-0 text-right text-sm text-subtle tabular-nums min-[360px]:inline">
                    {Math.round((sumOf(byCategory.slice(4)) / total) * 100)}%
                  </span>
                  <span className="shrink-0 text-right font-medium tabular-nums">
                    {formatMoney(sumOf(byCategory.slice(4)), currency)}
                  </span>
                </li>
              )}
            </ul>
          </>
        )}
      </Card>

      <QuickAdd />
      <DueBills rules={rules} today={today} />
      <ClaimCard />
      <InstallCard />
      <UpcomingBills rules={rules} today={today} />

      <section className="mt-7">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Recent</h2>
          {recent && recent.length > 0 && (
            <Link href="/activity" className="text-sm font-semibold text-ink">
              See all
            </Link>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No expenses yet"
            description="Log your first one. It takes about 3 seconds."
            action={<Button onClick={() => openAdd()}>Add expense</Button>}
          />
        ) : (
          <ExpenseList expenses={recent} currency={currency} />
        )}
      </section>
    </>
  );
}

function Comparison({ current, previous, currency }: { current: number; previous: number; currency: string }) {
  const diff = current - previous;
  if (Math.abs(diff) < 1) return <p className="mt-2 text-sm text-muted">Same as this point last month</p>;
  const less = diff < 0;
  const Icon = less ? TrendingDown : TrendingUp;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
      <Icon className={less ? "size-4 text-success" : "size-4 text-muted"} />
      <span>
        <span className="font-medium text-ink">{formatMoney(Math.abs(diff), currency)}</span> {less ? "less" : "more"}{" "}
        than this point last month
      </span>
    </p>
  );
}

const minISO = (a: string, b: string) => (a < b ? a : b);
const sumOf = (rows: { total: number }[]) => rows.reduce((sum, row) => sum + row.total, 0);
