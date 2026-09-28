"use client";

import { Check } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { CategoryChip } from "@/components/expenses/category-chip";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_COLORS, CATEGORY_EMOJIS, COLOR_NAMES, categoryStyle } from "@/lib/category-colors";
import { kindOf, type Category, type Kind } from "@/lib/db/local";
import { createCategory, deleteCategory, updateCategory } from "@/lib/db/mutations";
import { useCategories } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

type CategoryEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new category. */
  category: Category | null;
  /** Kind for a new category. */
  kind: Kind;
};

export function CategoryEditor({ open, onOpenChange, category, kind }: CategoryEditorProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={category ? "Edit category" : "New category"}>
      <EditorForm
        key={category?.id ?? `new-${kind}`}
        category={category}
        kind={category ? kindOf(category) : kind}
        onDone={() => onOpenChange(false)}
      />
    </Sheet>
  );
}

function EditorForm({ category, kind, onDone }: { category: Category | null; kind: Kind; onDone: () => void }) {
  const { db } = useData();
  const categories = useCategories(kind); // expenses can only move to a category of the same kind
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "🍔");
  const [color, setColor] = useState(category?.color ?? "sky");
  const [visible, setVisible] = useState(!category?.is_archived);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveTo, setMoveTo] = useState("");

  const expenseCount = useLiveQuery(
    () => (category ? db.expenses.where("category_id").equals(category.id).count() : 0),
    [db, category?.id],
  );
  const others = (categories ?? []).filter((c) => c.id !== category?.id);

  async function save() {
    if (!name.trim()) return toast.error("Give the category a name.");
    if (category) await updateCategory(db, category, { name, emoji, color, is_archived: !visible });
    else await createCategory(db, { name, emoji, color, kind });
    onDone();
  }

  async function remove() {
    if (!category) return;
    const target = others.find((c) => c.id === moveTo) ?? null;
    if (expenseCount && !target) return toast.error("Choose where to move its expenses.");
    await deleteCategory(db, category, target);
    toast(`Deleted ${category.name}`);
    onDone();
  }

  if (confirmDelete && category) {
    return (
      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-muted">
          {expenseCount
            ? `${expenseCount} ${expenseCount === 1 ? "expense uses" : "expenses use"} ${category.name}. Move them to:`
            : `Delete ${category.name}? It has no expenses.`}
        </p>
        {expenseCount ? (
          <div className="flex flex-wrap gap-2">
            {others.map((c) => (
              <CategoryChip key={c.id} category={c} selected={c.id === moveTo} onClick={() => setMoveTo(c.id)} />
            ))}
          </div>
        ) : null}
        <Button variant="danger" size="lg" className="w-full" onClick={remove} disabled={!!expenseCount && !moveTo}>
          Delete category
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setConfirmDelete(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <CategoryChip category={{ name: name || "Preview", emoji, color }} selected />
      </div>

      <div>
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <Label>Emoji</Label>
        <div className="grid grid-cols-8 gap-1.5">
          {CATEGORY_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === emoji}
              onClick={() => setEmoji(option)}
              className={cn(
                "grid aspect-square place-items-center rounded-xl text-xl transition active:scale-90",
                option === emoji ? "bg-ink/10 ring-2 ring-ink" : "bg-surface-2",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <Input
          className="mt-2 h-11"
          placeholder="Or type any emoji"
          maxLength={8}
          onChange={(e) => e.target.value.trim() && setEmoji(e.target.value.trim())}
        />
      </div>

      <div>
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_NAMES.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={option}
              aria-pressed={option === color}
              onClick={() => setColor(option)}
              style={categoryStyle(option)}
              className="cat-fill grid size-9 place-items-center rounded-full text-white transition active:scale-90"
            >
              {option === color && <Check className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <span className="sr-only">{Object.keys(CATEGORY_COLORS).length} colours</span>
      </div>

      {category && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span>
            <span className="block text-[15px] font-medium">Show when adding</span>
            <span className="block text-sm text-muted">Hidden categories keep their history</span>
          </span>
          <Switch label="Show when adding" checked={visible} onChange={setVisible} />
        </div>
      )}

      <Button size="lg" className="w-full" onClick={save}>
        {category ? "Save" : "Create category"}
      </Button>
      {category && (
        <Button variant="danger" size="lg" className="w-full" onClick={() => setConfirmDelete(true)}>
          Delete category
        </Button>
      )}
    </div>
  );
}
