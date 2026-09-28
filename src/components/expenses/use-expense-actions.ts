"use client";

import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { todayISO } from "@/lib/dates";
import type { Expense } from "@/lib/db/local";
import { deleteExpense, duplicateExpense, restoreExpense } from "@/lib/db/mutations";

/** Delete / duplicate with an Undo toast instead of "Are you sure?" dialogs. */
export function useExpenseActions() {
  const { db } = useData();

  return {
    remove(expense: Expense) {
      deleteExpense(db, expense);
      toast("Expense deleted", { action: { label: "Undo", onClick: () => restoreExpense(db, expense) } });
    },
    async duplicate(expense: Expense) {
      const copy = await duplicateExpense(db, expense, todayISO());
      toast("Added again for today", { action: { label: "Undo", onClick: () => deleteExpense(db, copy) } });
    },
  };
}
