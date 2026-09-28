"use client";

import { Copy, Trash2 } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useRef } from "react";
import { kindOf, type Category, type Expense, type PaymentMethod } from "@/lib/db/local";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { CategoryBadge } from "./category-chip";

const ACTION_THRESHOLD = 90;

type ExpenseRowProps = {
  expense: Expense;
  category?: Category;
  paymentMethod?: PaymentMethod;
  onOpen: () => void;
  /** Swipe left. */
  onDelete: () => void;
  /** Swipe right. */
  onDuplicate: () => void;
};

/** Tap to edit. Swipe left to delete, right to duplicate (both also in the edit sheet). */
export function ExpenseRow({ expense, category, paymentMethod, onOpen, onDelete, onDuplicate }: ExpenseRowProps) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const deleteOpacity = useTransform(x, [-ACTION_THRESHOLD, -20], [1, 0]);
  const duplicateOpacity = useTransform(x, [20, ACTION_THRESHOLD], [0, 1]);

  const title = expense.note || category?.name || "Expense";
  const income = kindOf(expense) === "income";
  const subtitle = [
    expense.note ? category?.name : null,
    paymentMethod?.name,
    expense.recurring_rule_id ? "Repeats" : null,
    expense.reimbursable ? (expense.reimbursed_at ? "Paid back" : "To claim") : null,
    expense.receipt_path ? "Receipt" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="relative overflow-hidden rounded-2xl">
      <motion.div
        style={{ opacity: duplicateOpacity }}
        className="absolute inset-0 flex items-center bg-ink pl-5 text-bg"
        aria-hidden
      >
        <Copy className="size-5" />
      </motion.div>
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 flex items-center justify-end bg-danger pr-5 text-white"
        aria-hidden
      >
        <Trash2 className="size-5" />
      </motion.div>

      <motion.button
        type="button"
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        style={{ x }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          if (info.offset.x <= -ACTION_THRESHOLD) onDelete();
          else if (info.offset.x >= ACTION_THRESHOLD) onDuplicate();
          animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
          setTimeout(() => (dragged.current = false), 0);
        }}
        onClick={() => !dragged.current && onOpen()}
        className="relative flex w-full items-center gap-3 bg-bg px-1 py-2.5 text-left"
      >
        <CategoryBadge category={category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
        </span>
        <span className={cn("shrink-0 text-[15px] font-semibold tabular-nums", income && "text-success")}>
          {income && "+"}
          {formatMoney(expense.amount_minor, expense.currency)}
        </span>
      </motion.button>
    </li>
  );
}
