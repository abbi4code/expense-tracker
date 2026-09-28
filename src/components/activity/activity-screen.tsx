"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PeriodSwitcher } from "@/components/app/period-switcher";
import { SyncStatus } from "@/components/app/sync-status";
import { CategoryChip } from "@/components/expenses/category-chip";
import { ExpenseList } from "@/components/expenses/expense-list";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { periodContaining, shiftPeriod } from "@/lib/dates";
import { countsAsSpending, type Expense } from "@/lib/db/local";
import {
  sumMinor,
  useCategories,
  useExpensesBetween,
  useOwedBack,
  usePaymentMethods,
  useSearch,
} from "@/lib/db/queries";
import { BackHeader } from "@/components/app/back-header";
import { formatMoney } from "@/lib/money";
import { useCurrentPeriod } from "@/lib/use-period";

export function ActivityScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { period: current, monthStartDay, profile } = useCurrentPeriod();

  const query = searchParams.get("q");
  const searching = query !== null;
  const monthParam = searchParams.get("month");
  const categoryId = searchParams.get("category");
  const paymentMethodId = searchParams.get("pm");
  const period = monthParam ? periodContaining(monthParam, monthStartDay) : current;
  const isCurrent = period.start === current.start;
  const currency = profile?.currency ?? "INR";

  const monthEntries = useExpensesBetween(period.start, period.end, "all");
  const results = useSearch({ query: query ?? "", categoryId, paymentMethodId });
  const owed = useOwedBack();
  const claimView = searchParams.get("claim") === "1";
  const categories = useCategories();
  const paymentMethods = usePaymentMethods();

  const entries = useMemo(() => {
    if (searching) return query.trim() || paymentMethodId || categoryId ? results : [];
    return categoryId ? monthEntries?.filter((e) => e.category_id === categoryId) : monthEntries;
  }, [searching, query, paymentMethodId, categoryId, results, monthEntries]);

  // Only offer category filters that appear this month (plus the active one).
  const usedCategories = useMemo(() => {
    const used = new Set(monthEntries?.map((e) => e.category_id));
    return (categories ?? []).filter((c) => used.has(c.id) || c.id === categoryId);
  }, [categories, monthEntries, categoryId]);

  function setParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  const goTo = (months: number) => {
    const next = shiftPeriod(period, months, monthStartDay);
    setParams({ month: next.start === current.start ? null : next.start });
  };

  if (claimView) {
    return (
      <>
        <BackHeader href="/home" backLabel="Home" title="To claim back" />
        <p className="mb-4 px-1 text-sm text-muted">
          Work expenses aren&apos;t counted in your spending. Open one and tap &ldquo;Mark paid back&rdquo; when
          you&apos;re reimbursed.
        </p>
        {!owed ? (
          <Skeleton className="h-40" />
        ) : owed.length === 0 ? (
          <EmptyState emoji="🎉" title="All paid back" description="Nothing left to claim." />
        ) : (
          <>
            <p className="mb-3 text-right text-sm text-muted">
              <span className="block text-base font-semibold text-ink tabular-nums">
                {formatMoney(sumMinor(owed), currency)}
              </span>
              {owed.length} {owed.length === 1 ? "expense" : "expenses"}
            </p>
            <ExpenseList expenses={owed} currency={currency} />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <header className="flex h-16 items-center justify-between pt-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Activity</h1>
        <div className="flex items-center gap-2">
          <SyncStatus />
          {!searching && (
            <button
              type="button"
              onClick={() => setParams({ q: "", category: null })}
              aria-label="Search"
              className="grid size-10 place-items-center rounded-full bg-surface-2 transition active:scale-90"
            >
              <Search className="size-5" />
            </button>
          )}
        </div>
      </header>

      {searching ? (
        <>
          <div className="flex items-center gap-2">
            <SearchBox initial={query} onChange={(q) => setParams({ q })} />
            <button
              type="button"
              onClick={() => setParams({ q: null, pm: null, category: null })}
              className="h-12 shrink-0 px-2 text-[15px] font-medium text-muted"
            >
              Cancel
            </button>
          </div>
          {paymentMethods && paymentMethods.length > 0 && (
            <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar" aria-label="Payment method">
              {paymentMethods.map((method) => (
                <Chip
                  key={method.id}
                  selected={method.id === paymentMethodId}
                  onClick={() => setParams({ pm: method.id === paymentMethodId ? null : method.id })}
                >
                  {method.name}
                </Chip>
              ))}
              {categoryId && (
                <Chip selected onClick={() => setParams({ category: null })}>
                  {categories?.find((c) => c.id === categoryId)?.name ?? "Category"} <X className="size-3.5" />
                </Chip>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <PeriodSwitcher period={period} onPrevious={() => goTo(-1)} onNext={() => goTo(1)} canGoNext={!isCurrent} />
            {entries && <Summary entries={entries} currency={currency} />}
          </div>

          {usedCategories.length > 1 || categoryId ? (
            <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 no-scrollbar">
              <Chip selected={!categoryId} onClick={() => setParams({ category: null })}>
                All
              </Chip>
              {usedCategories.map((category) => (
                <CategoryChip
                  key={category.id}
                  category={category}
                  selected={category.id === categoryId}
                  onClick={() => setParams({ category: category.id === categoryId ? null : category.id })}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5">
        {!entries ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : searching && !query.trim() && !paymentMethodId && !categoryId ? (
          <p className="px-1 text-[15px] leading-relaxed text-muted">
            Search every expense by note, category or <span className="font-medium text-ink">#tag</span>. Use{" "}
            <span className="font-medium text-ink">&gt;500</span> or{" "}
            <span className="font-medium text-ink">&lt;100</span> for amounts.
          </p>
        ) : entries.length === 0 ? (
          <EmptyState
            emoji={searching ? "🔍" : "📜"}
            title={searching ? "No matches" : categoryId ? "Nothing in this category" : "Nothing this month"}
            description={
              searching
                ? "Try another word or amount."
                : isCurrent
                  ? "Tap + to log an expense."
                  : "No entries in this period."
            }
          />
        ) : (
          <>
            {searching && (
              <div className="mb-3 flex justify-end">
                <Summary entries={entries} currency={currency} />
              </div>
            )}
            <ExpenseList expenses={entries} currency={currency} />
            <p className="mt-6 text-center text-xs text-subtle">Tip: swipe left to delete, right to repeat today.</p>
          </>
        )}
      </div>
    </>
  );
}

function Summary({ entries, currency }: { entries: Expense[]; currency: string }) {
  const spent = sumMinor(entries.filter(countsAsSpending));
  return (
    <p className="text-right text-sm text-muted">
      <span className="block text-base font-semibold text-ink tabular-nums">{formatMoney(spent, currency)}</span>
      {entries.length} {entries.length === 1 ? "entry" : "entries"}
    </p>
  );
}

/** Keeps its own text (URL updates are async, so binding the input to them can drop keystrokes). */
function SearchBox({ initial, onChange }: { initial: string; onChange: (query: string) => void }) {
  const [text, setText] = useState(initial);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const timer = setTimeout(() => onChangeRef.current(text), 200);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-ink">
      <Search className="size-5 shrink-0 text-subtle" />
      <input
        type="search"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Notes, #tags, >500"
        aria-label="Search expenses"
        enterKeyHint="search"
        className="h-full w-full bg-transparent text-base outline-none placeholder:text-subtle"
      />
    </label>
  );
}
