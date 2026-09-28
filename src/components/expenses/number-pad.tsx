"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "+", "4", "5", "6", "-", "7", "8", "9", "backspace", ".", "0"] as const;

const LABELS: Record<string, React.ReactNode> = {
  "+": "+",
  "-": "−",
  backspace: <Delete className="size-6" />,
};

type NumberPadProps = {
  onKey: (key: string) => void;
  onSave: () => void;
  saveLabel: string;
  saveDisabled?: boolean;
  allowDecimal: boolean;
};

export function NumberPad({ onKey, onSave, saveLabel, saveDisabled, allowDecimal }: NumberPadProps) {
  const press = (key: string) => {
    navigator.vibrate?.(8); // subtle tick on Android; iOS ignores it
    onKey(key);
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {KEYS.map((key) => {
        const isOperator = key === "+" || key === "-" || key === "backspace";
        return (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={key === "." && !allowDecimal}
            aria-label={key === "backspace" ? "Delete digit" : key === "-" ? "Minus" : key === "+" ? "Plus" : undefined}
            className={cn(
              "grid h-[clamp(2.75rem,8dvh,3.5rem)] place-items-center rounded-2xl text-2xl font-medium tabular-nums transition select-none active:scale-95 disabled:opacity-30",
              isOperator ? "bg-surface-2 text-muted" : "border border-line bg-surface text-ink",
            )}
          >
            {LABELS[key] ?? key}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className="col-span-2 h-[clamp(2.75rem,8dvh,3.5rem)] rounded-2xl bg-ink text-lg font-semibold text-bg transition active:scale-[0.97] disabled:opacity-40"
      >
        {saveLabel}
      </button>
    </div>
  );
}
