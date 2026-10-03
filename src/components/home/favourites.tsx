"use client";

import { ChevronDown, ChevronUp, Plus, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { Category, Favourite } from "@/lib/db/local";
import { addFavourite, deleteExpense, logFavourite, removeFavourite, reorderFavourites } from "@/lib/db/mutations";
import { useCategoryMap, useFavourites, useFavouriteSuggestions } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";

const LONG_PRESS_MS = 500;

const label = (f: { note: string | null; category_id: string }, categories: Map<string, Category>) =>
  f.note || categories.get(f.category_id)?.name || "Expense";

/** Home: one tap on a favourite logs it for today. Long-press or "+" to manage them. */
export function FavouritesRow() {
  const { db } = useData();
  const favourites = useFavourites();
  const suggestions = useFavouriteSuggestions();
  const categories = useCategoryMap();
  const [managing, setManaging] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  if (!favourites || !suggestions || (!favourites.length && !suggestions.length)) return null;

  async function log(favourite: Favourite) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    navigator.vibrate?.(10);
    const expense = await logFavourite(db, favourite);
    const category = categories.get(favourite.category_id);
    toast(
      `Added ${formatMoney(expense.amount_minor, expense.currency)} · ${category?.emoji ?? ""} ${label(favourite, categories)}`,
      {
        action: { label: "Undo", onClick: () => deleteExpense(db, expense) },
      },
    );
  }

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setManaging(true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <section aria-label="Favourites" className="mt-3">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        {favourites.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => log(f)}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Log ${label(f, categories)}, ${formatMoney(f.amount_minor, f.currency)}`}
            className="flex h-16 max-w-40 min-w-26 shrink-0 flex-col justify-center rounded-2xl border border-line bg-surface px-3 text-left transition select-none active:scale-95"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <span aria-hidden>{categories.get(f.category_id)?.emoji}</span>
              <span className="truncate">{label(f, categories)}</span>
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{formatMoney(f.amount_minor, f.currency)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setManaging(true)}
          aria-label="Add or edit favourites"
          className="flex h-16 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-line px-4 text-sm font-medium text-muted transition active:scale-95"
        >
          {favourites.length ? (
            <Plus className="size-5" />
          ) : (
            <>
              <Star className="size-4" /> Pin your regulars
            </>
          )}
        </button>
      </div>
      <FavouritesSheet open={managing} onOpenChange={setManaging} />
    </section>
  );
}

function FavouritesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { db } = useData();
  const favourites = useFavourites() ?? [];
  const suggestions = useFavouriteSuggestions() ?? [];
  const categories = useCategoryMap();

  const move = (index: number, by: number) => {
    const ordered = [...favourites];
    const [item] = ordered.splice(index, 1);
    ordered.splice(index + by, 0, item);
    reorderFavourites(db, ordered);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Favourites"
      description="Tap one on Home to log it for today."
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Pinned</h3>
          {favourites.length === 0 ? (
            <p className="text-[15px] text-muted">Nothing pinned yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {favourites.map((f, index) => (
                <li key={f.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                  <span aria-hidden>{categories.get(f.category_id)?.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{label(f, categories)}</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {formatMoney(f.amount_minor, f.currency)}
                  </span>
                  <IconButton
                    label={`Move ${label(f, categories)} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Move ${label(f, categories)} down`}
                    disabled={index === favourites.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${label(f, categories)}`}
                    onClick={async () => {
                      await removeFavourite(db, f);
                      toast(`Removed ${label(f, categories)}`, {
                        action: { label: "Undo", onClick: () => removeFavourite(db, f, false) },
                      });
                    }}
                  >
                    <X className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">You log these often</h3>
          {suggestions.length === 0 ? (
            <p className="text-[15px] text-muted">Log the same thing 3 times and it shows up here.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {suggestions.map((s) => (
                <li
                  key={`${s.amount_minor}-${s.category_id}-${s.note}`}
                  className="flex items-center gap-2 py-1.5 pr-1.5 pl-3"
                >
                  <span aria-hidden>{categories.get(s.category_id)?.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{label(s, categories)}</span>
                    <span className="block text-sm text-muted">
                      {formatMoney(s.amount_minor, s.currency)} · {s.count} times
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Pin ${label(s, categories)}`}
                    onClick={() => addFavourite(db, s)}
                  >
                    Pin
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-subtle">You can also open any expense and tap ☆ Favourite.</p>
      </div>
    </Sheet>
  );
}

function IconButton({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition active:scale-90 disabled:opacity-30"
      {...props}
    />
  );
}
