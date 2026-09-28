import { categoryStyle } from "@/lib/category-colors";
import type { Category } from "@/lib/db/local";
import { cn } from "@/lib/utils";

type CategoryChipProps = Omit<React.ComponentProps<"button">, "children"> & {
  category: Pick<Category, "name" | "emoji" | "color">;
  selected?: boolean;
};

export function CategoryChip({ category, selected = false, className, ...props }: CategoryChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      style={categoryStyle(category.color)}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        selected ? "cat-bg cat-fg border-transparent ring-2 ring-current" : "border-line bg-surface text-ink",
        className,
      )}
      {...props}
    >
      <span className="text-base leading-none">{category.emoji}</span>
      {category.name}
    </button>
  );
}

/** Round emoji badge in the category colour (used in lists). */
export function CategoryBadge({
  category,
  className,
}: {
  category?: Pick<Category, "emoji" | "color">;
  className?: string;
}) {
  return (
    <span
      style={categoryStyle(category?.color ?? "slate")}
      className={cn("cat-bg grid size-11 shrink-0 place-items-center rounded-2xl text-xl", className)}
      aria-hidden
    >
      {category?.emoji ?? "💸"}
    </span>
  );
}
