"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";
import { POPULAR_CURRENCIES, allCurrencies, currencyName } from "@/lib/currencies";
import { currencySymbol } from "@/lib/money";
import { cn } from "@/lib/utils";

type CurrencyPickerProps = { value: string; onChange: (code: string) => void; suggested?: string };

/** Popular currencies as a list, everything else in a native select (best on phones). */
export function CurrencyPicker({ value, onChange, suggested }: CurrencyPickerProps) {
  const popular = useMemo(() => {
    const codes = [suggested, value, ...POPULAR_CURRENCIES].filter(Boolean) as string[];
    return [...new Set(codes)].slice(0, 6);
  }, [suggested, value]);
  const others = useMemo(() => allCurrencies().filter((code) => !popular.includes(code)), [popular]);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Currency"
        className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
      >
        {popular.map((code) => {
          const selected = code === value;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(code)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg font-semibold">
                {currencySymbol(code)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{currencyName(code)}</span>
                <span className="block text-sm text-muted">
                  {code}
                  {code === suggested && " · suggested"}
                </span>
              </span>
              <Check className={cn("size-5 text-ink", !selected && "invisible")} />
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-1 text-[15px] text-muted">
        Other currency
        <select
          value={popular.includes(value) ? "" : value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-11 max-w-[60%] rounded-xl border border-line bg-surface px-3 text-base text-ink"
        >
          <option value="">Choose…</option>
          {others.map((code) => (
            <option key={code} value={code}>
              {code} · {currencyName(code)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
