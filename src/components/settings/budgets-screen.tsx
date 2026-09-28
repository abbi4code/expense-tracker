"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { CategoryBadge } from "@/components/expenses/category-chip";
import { AmountInput, parseAmount } from "@/components/ui/amount-input";
import { BudgetBar } from "@/components/ui/budget-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/lib/db/local";
import { setBudget } from "@/lib/db/mutations";
import { sumMinor, useBudgets, useCategories, useExpensesBetween } from "@/lib/db/queries";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import { useCurrentPeriod } from "@/lib/use-period";

type Editing = { open: boolean; category: Category | null };

export function BudgetsScreen() {
  const { db } = useData();
  const { period, profile } = useCurrentPeriod();
  const budgets = useBudgets();
  const categories = useCategories();
  const expenses = useExpensesBetween(period.start, period.end);
  const [editing, setEditing] = useState<Editing>({ open: false, category: null });
  const currency = profile?.currency ?? "INR";

  const spentIn = (categoryId: string | null) =>
    sumMinor((expenses ?? []).filter((e) => categoryId === null || e.category_id === categoryId));
  const overall = budgets?.get("overall");
  const editingKey = editing.category?.id ?? "overall";
  const current = budgets?.get(editingKey);

  async function save(amount: number | null) {
    await setBudget(db, editing.category?.id ?? null, amount === null ? null : toMinor(amount, currency));
    setEditing((s) => ({ ...s, open: false }));
    toast.success(amount === null ? "Budget removed" : "Budget saved");
  }

  return (
    <>
      <BackHeader href="/settings" backLabel="Settings" title="Budgets" />

      {!budgets || !categories ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <Card>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setEditing({ open: true, category: null })}
            >
              <span>
                <span className="block text-sm font-medium text-muted">Monthly budget · {period.shortLabel}</span>
                <span className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums">
                  {overall ? formatMoney(overall, currency) : "Not set"}
                </span>
              </span>
              <ChevronRight className="size-5 text-subtle" />
            </button>
            {overall ? (
              <BudgetBar spent={spentIn(null)} budget={overall} currency={currency} className="mt-4" />
            ) : (
              <p className="mt-2 text-sm text-muted">Set one to see how much you can safely spend each day on Home.</p>
            )}
          </Card>

          <h2 className="mt-7 mb-1 px-1 text-sm font-semibold tracking-wide text-muted uppercase">
            By category <span className="font-normal normal-case">(optional)</span>
          </h2>
          <p className="mb-3 px-1 text-sm text-muted">Limits for the categories you want to watch.</p>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {categories
              .filter((c) => !c.is_archived)
              .map((category) => {
                const budget = budgets.get(category.id);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ open: true, category })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
                    >
                      <CategoryBadge category={category} className="size-10 text-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] font-medium">{category.name}</span>
                          <span className="shrink-0 text-sm text-muted tabular-nums">
                            {budget ? formatMoney(budget, currency) : "No limit"}
                          </span>
                        </span>
                        {budget && (
                          <BudgetBar
                            spent={spentIn(category.id)}
                            budget={budget}
                            currency={currency}
                            className="mt-2"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </>
      )}

      <Sheet
        open={editing.open}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
        title={editing.category ? `${editing.category.emoji} ${editing.category.name} budget` : "Monthly budget"}
        description={
          editing.category
            ? "The most you want to spend on this each month."
            : "The most you want to spend in total each month, bills included."
        }
      >
        <form
          key={`${editingKey}-${editing.open}`}
          onSubmit={(e) => {
            e.preventDefault();
            const amount = parseAmount(String(new FormData(e.currentTarget).get("amount") ?? ""));
            if (amount === null) return toast.error("Enter an amount above zero.");
            save(amount);
          }}
          className="space-y-3"
        >
          <AmountInput
            name="amount"
            currency={currency}
            defaultValue={current ? String(fromMinor(current, currency)) : ""}
            autoFocus
            aria-label="Budget amount"
          />
          <Button type="submit" size="lg" className="w-full">
            Save budget
          </Button>
          {current && (
            <Button type="button" variant="danger" size="lg" className="w-full" onClick={() => save(null)}>
              Remove budget
            </Button>
          )}
        </form>
      </Sheet>
    </>
  );
}
