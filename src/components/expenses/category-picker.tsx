"use client";

import { ArrowLeft, LayoutGrid, Plus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryStyle } from "@/lib/category-colors";
import type { Category } from "@/lib/db/local";
import { KEYWORDS } from "@/lib/quick-entry";
import { cn } from "@/lib/utils";

const QUICK_SLOTS = 4;

type Tile = Pick<Category, "id" | "name" | "emoji" | "color">;

/** One category as a square tile: emoji on top, name below. */
function CategoryTile({ category, selected, onClick }: { category: Tile; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={category.name}
      onClick={onClick}
      style={categoryStyle(category.color)}
      className={cn(
        "flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 transition active:scale-95",
        selected ? "cat-bg cat-fg border-transparent ring-2 ring-current" : "border-line bg-surface text-ink",
      )}
    >
      <span className="text-lg leading-none" aria-hidden>
        {category.emoji}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-medium">{category.name}</span>
    </button>
  );
}

type QuickRowProps = {
  /** Categories sorted most-used first. */
  categories: Tile[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onMore: () => void;
};

/**
 * Your 4 most-used categories + "All", in one row that never scrolls. If the selected category
 * isn't among the top 4, it takes the last slot so the choice is always visible.
 */
export function CategoryQuickRow({ categories, selectedId, onSelect, onMore }: QuickRowProps) {
  let slots = categories.slice(0, QUICK_SLOTS);
  const selected = categories.find((c) => c.id === selectedId);
  if (selected && !slots.some((c) => c.id === selected.id)) slots = [...slots.slice(0, QUICK_SLOTS - 1), selected];

  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Category">
      {slots.map((category) => (
        <CategoryTile
          key={category.id}
          category={category}
          selected={category.id === selectedId}
          onClick={() => onSelect(category.id)}
        />
      ))}
      <button
        type="button"
        onClick={onMore}
        aria-label={`All categories (${categories.length})`}
        className="flex h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-line text-muted transition active:scale-95"
      >
        <LayoutGrid className="size-[18px]" aria-hidden />
        <span className="text-[11px] leading-tight font-medium">All {categories.length}</span>
      </button>
    </div>
  );
}

type PickerProps = {
  categories: Tile[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onBack: () => void;
  /** Leaves the sheet for Settings → Categories. */
  onManage: () => void;
};

/** Everyday words that should find a category ("uber" → Transport), from the quick-entry keywords. */
function matches(category: Tile, term: string) {
  if (!term) return true;
  const name = category.name.toLowerCase();
  if (name.includes(term)) return true;
  return (KEYWORDS[category.name] ?? []).some((word) => word.startsWith(term));
}

/** Every category in a searchable grid, shown in place of the number pad. */
export function CategoryPicker({ categories, selectedId, onSelect, onCreate, onBack, onManage }: PickerProps) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    const found = categories.filter((c) => matches(c, term));
    // Names starting with the search come first, then other matches, keeping usage order.
    return term
      ? [...found].sort(
          (a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)),
        )
      : found;
  }, [categories, term]);
  const exact = categories.some((c) => c.name.toLowerCase() === term);
  const canCreate = term.length > 0 && !exact;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 transition active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-ink">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (results[0]) onSelect(results[0].id);
              else if (canCreate) onCreate(query.trim());
            }}
            // Typing is quicker on a keyboard; on phones let people browse first.
            autoFocus={typeof window !== "undefined" && matchMedia("(pointer: fine)").matches}
            placeholder="Search, e.g. rent or uber"
            aria-label="Search categories"
            enterKeyHint="go"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <div className="max-h-[min(22rem,48dvh)] overflow-y-auto overscroll-contain">
        {results.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-5">
            {results.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                selected={category.id === selectedId}
                onClick={() => onSelect(category.id)}
              />
            ))}
          </div>
        ) : (
          <p className="px-1 py-4 text-center text-[15px] text-muted">
            No category matches &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {canCreate && (
          <button
            type="button"
            onClick={() => onCreate(query.trim())}
            className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-bg transition active:scale-[0.97]"
          >
            <Plus className="size-4 shrink-0" />
            <span className="truncate">Create &ldquo;{query.trim()}&rdquo;</span>
          </button>
        )}
        <Link
          href="/settings/categories"
          onClick={onManage}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm font-medium",
            !canCreate && "flex-1",
          )}
        >
          <Settings2 className="size-4" />
          Manage
        </Link>
      </div>
    </div>
  );
}
