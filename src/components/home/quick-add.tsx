"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { useExpenseSheet } from "@/components/expenses/expense-sheet";
import { relativeDayLabel, todayISO } from "@/lib/dates";
import { createExpense, deleteExpense } from "@/lib/db/mutations";
import { useCategoryMap, useProfile } from "@/lib/db/queries";
import { formatMoney, toMinor } from "@/lib/money";
import { useQuickEntryParser } from "@/lib/use-quick-entry";

/**
 * Type "coffee 120" or "uber 340 yesterday upi" and press enter. Saved straight away when we
 * understood both the amount and the category; otherwise the Add sheet opens prefilled.
 */
export function QuickAdd() {
  const { db } = useData();
  const profile = useProfile();
  const categories = useCategoryMap();
  const { openAdd } = useExpenseSheet();
  const { parse } = useQuickEntryParser();
  const [text, setText] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const entry = parse(text);
    const currency = profile?.currency ?? "INR";
    setText("");

    if (!entry.amount || !entry.categoryId) {
      openAdd(entry);
      return;
    }
    const expense = await createExpense(db, {
      amount_minor: toMinor(entry.amount, currency),
      currency,
      category_id: entry.categoryId,
      payment_method_id: entry.paymentMethodId,
      note: entry.note || null,
      spent_on: entry.spentOn,
    });
    const category = categories.get(entry.categoryId);
    const day = entry.spentOn === todayISO() ? "" : ` · ${relativeDayLabel(entry.spentOn).toLowerCase()}`;
    toast(
      `Added ${formatMoney(expense.amount_minor, currency)} · ${category?.emoji ?? ""} ${category?.name ?? ""}${day}`,
      {
        action: { label: "Undo", onClick: () => deleteExpense(db, expense) },
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex h-12 items-center gap-2 rounded-full border border-line bg-surface pr-1.5 pl-4 focus-within:border-ink"
    >
      <Sparkles className="size-4 shrink-0 text-subtle" aria-hidden />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick add: coffee 120"
        aria-label="Quick add, for example coffee 120 or uber 340 yesterday"
        enterKeyHint="done"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
      />
      <button
        type="submit"
        aria-label="Add"
        disabled={!text.trim()}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg transition active:scale-90 disabled:opacity-30"
      >
        <ArrowUp className="size-4" strokeWidth={2.5} />
      </button>
    </form>
  );
}
