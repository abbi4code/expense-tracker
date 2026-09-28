import { cn } from "@/lib/utils";

export type ChipProps = React.ComponentProps<"button"> & { selected?: boolean };

export function Chip({ className, selected = false, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition active:scale-95",
        selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}
