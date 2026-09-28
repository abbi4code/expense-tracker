"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Period } from "@/lib/dates";

type PeriodSwitcherProps = { period: Period; onPrevious: () => void; onNext: () => void; canGoNext: boolean };

export function PeriodSwitcher({ period, onPrevious, onNext, canGoNext }: PeriodSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous month"
        className="grid size-9 place-items-center rounded-full bg-surface-2 transition active:scale-90"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="min-w-28 text-center text-[15px] font-semibold" aria-live="polite">
        {period.label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next month"
        className="grid size-9 place-items-center rounded-full bg-surface-2 transition active:scale-90 disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
