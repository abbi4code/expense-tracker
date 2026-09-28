"use client";

import { cn } from "@/lib/utils";

export type Column = { key: string; label: string; fullLabel: string; value: number };

type ColumnChartProps = {
  columns: Column[];
  selectedKey: string;
  onSelect: (key: string) => void;
  format: (value: number) => string;
  height?: number;
};

/**
 * Single-series column chart. One hue; the selected column is solid and named in the caption
 * (tap a column to inspect it); thin bars, 4px rounded tops, square on a shared baseline.
 */
export function ColumnChart({ columns, selectedKey, onSelect, format, height = 120 }: ColumnChartProps) {
  const max = Math.max(1, ...columns.map((c) => c.value));
  const selected = columns.find((c) => c.key === selectedKey) ?? columns[columns.length - 1];

  return (
    <figure>
      <figcaption className="mb-3 text-sm text-muted" aria-live="polite">
        {selected.fullLabel} · <span className="font-semibold text-ink tabular-nums">{format(selected.value)}</span>
      </figcaption>
      <div className="flex items-end border-b border-line" style={{ height }}>
        {columns.map((column) => {
          const active = column.key === selected.key;
          return (
            <button
              key={column.key}
              type="button"
              onClick={() => onSelect(column.key)}
              aria-label={`${column.fullLabel}: ${format(column.value)}`}
              aria-pressed={active}
              className="flex h-full flex-1 items-end justify-center"
            >
              <span
                className={cn("w-full max-w-6 rounded-t-[4px] transition-colors", active ? "bg-ink" : "bg-ink/20")}
                style={{ height: `${Math.max(column.value > 0 ? 2 : 0, (column.value / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex">
        {columns.map((column) => (
          <span
            key={column.key}
            className={cn(
              "flex-1 text-center text-xs",
              column.key === selected.key ? "font-semibold text-ink" : "text-subtle",
            )}
            aria-hidden
          >
            {column.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
