import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-ink text-bg hover:bg-ink/90",
  accent: "bg-accent text-accent-ink hover:brightness-95",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-5 text-[15px]",
  lg: "h-14 px-6 text-base",
  icon: "size-11",
} as const;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      aria-hidden
    />
  );
}
