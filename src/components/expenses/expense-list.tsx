"use client";

import { relativeDayLabel } from "@/lib/dates";
import { countsAsSpending, type Expense } from "@/lib/db/local";
import { sumMinor, useCategoryMap, usePaymentMethodMap } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { ExpenseRow } from "./expense-row";
import { useExpenseSheet } from "./expense-sheet";
import { useExpenseActions } from "./use-expense-actions";

type ExpenseListProps = { expenses: Expense[]; currency: string; groupByDay?: boolean };

export function ExpenseList({ expenses, currency, groupByDay = true }: ExpenseListProps) {
  const categories = useCategoryMap();
  const paymentMethods = usePaymentMethodMap();
  const { openEdit } = useExpenseSheet();
  const actions = useExpenseActions();

  const row = (expense: Expense) => (
    <ExpenseRow
      key={expense.id}
      expense={expense}
      category={categories.get(expense.category_id)}
      paymentMethod={expense.payment_method_id ? paymentMethods.get(expense.payment_method_id) : undefined}
      onOpen={() => openEdit(expense)}
      onDelete={() => actions.remove(expense)}
      onDuplicate={() => actions.duplicate(expense)}
    />
  );

  if (!groupByDay) return <ul className="space-y-0.5">{expenses.map(row)}</ul>;

  const days = new Map<string, Expense[]>();
  for (const expense of expenses) days.set(expense.spent_on, [...(days.get(expense.spent_on) ?? []), expense]);

  return (
    <div className="space-y-5">
      {[...days].map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-1 flex items-baseline justify-between px-1 text-sm font-medium text-muted">
            <span>{relativeDayLabel(day)}</span>
            <span className="tabular-nums">{formatMoney(sumMinor(items.filter(countsAsSpending)), currency)}</span>
          </h3>
          <ul className="space-y-0.5">{items.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}
