import { cn } from "@/lib/utils";

type SwitchProps = { checked: boolean; onChange: (checked: boolean) => void; label: string };

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-ink" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
