"use client";

import { currencySymbol, fractionDigits } from "@/lib/money";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<React.ComponentProps<"input">, "type"> & { currency: string };

/** Plain amount field with the currency symbol; parse with `parseAmount`. */
export function AmountInput({ currency, className, ...props }: AmountInputProps) {
  return (
    <div
      className={cn(
        "flex h-14 items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-ink",
        className,
      )}
    >
      <span className="text-xl font-semibold text-muted">{currencySymbol(currency)}</span>
      <input
        type="text"
        inputMode={fractionDigits(currency) ? "decimal" : "numeric"}
        autoComplete="off"
        className="h-full w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-subtle"
        placeholder="0"
        {...props}
      />
    </div>
  );
}

/** "12,500.50" → 12500.5; null if not a positive number. */
export function parseAmount(text: string): number | null {
  const value = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}
