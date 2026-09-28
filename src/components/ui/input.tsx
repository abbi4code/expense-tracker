import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        // text-base (16px) stops iOS from zooming in on focus.
        "h-13 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink transition",
        "placeholder:text-subtle focus:border-ink focus:outline-none",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-muted", className)} {...props} />;
}
