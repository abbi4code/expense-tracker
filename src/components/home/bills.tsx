"use client";

import Link from "next/link";
import { useData } from "@/components/data/data-provider";
import { CategoryBadge } from "@/components/expenses/category-chip";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween, relativeDayLabel } from "@/lib/dates";
import { kindOf, type RecurringRule } from "@/lib/db/local";
import { resolveDueOccurrence } from "@/lib/db/mutations";
import { useCategoryMap } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { occurrencesBetween } from "@/lib/recurrence";

type BillsProps = { rules: RecurringRule[] | undefined; today: string };

const active = (rule: RecurringRule) => rule.is_active && !rule.deleted_at;

/** "Ask me first" bills that have come due: add or skip each one. */
export function DueBills({ rules, today }: BillsProps) {
  const { db } = useData();
  const categories = useCategoryMap();
  const due = (rules ?? []).filter((r) => active(r) && r.mode === "ask" && r.next_due_on <= today);
  if (!due.length) return null;

  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-4" aria-label="Due now">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Due now</h2>
      <ul className="divide-y divide-line">
        {due.map((rule) => (
          <li key={rule.id} className="flex gap-3 py-3">
            <CategoryBadge category={categories.get(rule.category_id)} className="size-10 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-medium">
                  {rule.note || categories.get(rule.category_id)?.name}
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                  {formatMoney(rule.amount_minor, rule.currency)}
                </span>
              </p>
              <p className="text-sm text-muted">Due {relativeDayLabel(rule.next_due_on, today)}</p>
              {/* Actions sit on the left, where the floating + button can't cover them. */}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => resolveDueOccurrence(db, rule, true)}>
                  {kindOf(rule) === "income" ? "Received" : "Paid"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => resolveDueOccurrence(db, rule, false)}>
                  Skip this one
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bills coming up in the next 7 days. */
export function UpcomingBills({ rules, today }: BillsProps) {
  const categories = useCategoryMap();
  const until = addDays(today, 8);
  const upcoming = (rules ?? [])
    .filter((r) => active(r) && kindOf(r) === "expense")
    .flatMap((rule) => occurrencesBetween(rule, addDays(today, 1), until).map((date) => ({ rule, date })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  if (!upcoming.length) return null;

  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Coming up</h2>
        <Link href="/settings/recurring" className="text-sm font-semibold text-ink">
          All bills
        </Link>
      </div>
      <ul className="space-y-0.5">
        {upcoming.map(({ rule, date }) => {
          const days = daysBetween(today, date);
          return (
            <li key={`${rule.id}:${date}`} className="flex items-center gap-3 px-1 py-2">
              <CategoryBadge category={categories.get(rule.category_id)} className="size-10 text-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">
                  {rule.note || categories.get(rule.category_id)?.name}
                </span>
                <span className="block text-sm text-muted">
                  {days === 1 ? "Tomorrow" : `In ${days} days`}
                  {rule.mode === "ask" ? " · asks first" : ""}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {formatMoney(rule.amount_minor, rule.currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
