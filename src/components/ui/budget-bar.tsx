import { AlertTriangle, Check, CircleAlert } from "lucide-react";
import { budgetStatus } from "@/lib/budget";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS = {
  ok: { bar: "bg-success", text: "text-success", Icon: Check },
  close: { bar: "bg-warning", text: "text-warning", Icon: AlertTriangle },
  over: { bar: "bg-danger", text: "text-danger", Icon: CircleAlert },
} as const;

type BudgetBarProps = { spent: number; budget: number; currency: string; className?: string; showLabel?: boolean };

/** "₹2,950 left of ₹5,000" with a status icon, for use under another bar. */
export function BudgetLabel({ spent, budget, currency, className }: Omit<BudgetBarProps, "showLabel">) {
  const { text, Icon } = STATUS[budgetStatus(spent, budget)];
  const left = budget - spent;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm text-muted", className)}>
      <Icon className={cn("size-3.5 shrink-0", text)} aria-hidden />
      <span>
        <span className="font-medium text-ink">{formatMoney(Math.abs(left), currency)}</span>{" "}
        {left >= 0 ? "left of" : "over"} {formatMoney(budget, currency)}
      </span>
    </p>
  );
}

/** Budget meter: status is carried by icon + words as well as colour. */
export function BudgetBar({ spent, budget, currency, className, showLabel = true }: BudgetBarProps) {
  const status = budgetStatus(spent, budget);
  const { bar, text, Icon } = STATUS[status];
  const left = budget - spent;
  return (
    <div className={className}>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(spent, budget)}
        aria-label="Budget used"
      >
        <div
          className={cn("h-full rounded-full", bar)}
          style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <Icon className={cn("size-3.5 shrink-0", text)} aria-hidden />
          <span>
            {left >= 0 ? (
              <>
                <span className="font-medium text-ink">{formatMoney(left, currency)}</span> left of{" "}
                {formatMoney(budget, currency)}
              </>
            ) : (
              <>
                <span className="font-medium text-ink">{formatMoney(-left, currency)}</span> over{" "}
                {formatMoney(budget, currency)}
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
