import { cn } from "@/lib/utils";

type EmptyStateProps = {
  emoji: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ emoji, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-20 place-items-center rounded-[1.75rem] border border-line bg-surface text-4xl">
        {emoji}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 max-w-64 text-[15px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
