import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</div>
    </section>
  );
}

type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  className?: string;
};

export function SettingsRow({ icon, label, hint, onClick, trailing, className }: SettingsRowProps) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      {trailing ?? (onClick && <ChevronRight className="size-5 text-subtle" />)}
    </>
  );
  const classes = cn("flex w-full items-center gap-3 px-4 py-3.5 text-left", className);

  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, "transition active:bg-surface-2")}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
