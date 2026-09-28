"use client";

import { GripVertical, Plus } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { CategoryBadge } from "@/components/expenses/category-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/lib/db/local";
import { reorderCategories } from "@/lib/db/mutations";
import type { Kind } from "@/lib/db/local";
import { useCategories, useProfile } from "@/lib/db/queries";
import { cn } from "@/lib/utils";
import { CategoryEditor } from "./category-editor";

export function CategoriesScreen() {
  const { db } = useData();
  const profile = useProfile();
  const [kind, setKind] = useState<Kind>("expense");
  const categories = useCategories(kind);
  // While dragging, the list order lives here; it's saved when the drag ends.
  const [dragOrder, setDragOrder] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const list = dragOrder ?? categories;

  async function commitOrder() {
    if (dragOrder) await reorderCategories(db, dragOrder);
    setDragOrder(null);
  }

  return (
    <>
      <BackHeader
        href="/settings"
        backLabel="Settings"
        title="Categories"
        action={
          <Button size="sm" onClick={() => setEditing({ open: true, category: null })}>
            <Plus className="size-4" /> New
          </Button>
        }
      />
      {profile?.track_income && (
        <div
          role="radiogroup"
          aria-label="Category type"
          className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1"
        >
          {(["expense", "income"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => {
                setKind(option);
                setDragOrder(null);
              }}
              className={cn(
                "h-10 rounded-xl text-sm font-medium capitalize transition",
                kind === option ? "bg-surface text-ink shadow-sm" : "text-muted",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <p className="mb-4 px-1 text-sm text-muted">Tap to edit. Drag the handle to reorder.</p>

      {!list ? (
        <Skeleton className="h-96" />
      ) : (
        <Reorder.Group
          axis="y"
          values={list}
          onReorder={setDragOrder}
          className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
        >
          {list.map((category) => (
            <Row
              key={category.id}
              category={category}
              onEdit={() => setEditing({ open: true, category })}
              onDragEnd={commitOrder}
            />
          ))}
        </Reorder.Group>
      )}

      <CategoryEditor
        open={editing.open}
        category={editing.category}
        kind={kind}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
    </>
  );
}

function Row({ category, onEdit, onDragEnd }: { category: Category; onEdit: () => void; onDragEnd: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={category}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="flex items-center bg-surface"
    >
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left">
        <CategoryBadge category={category} className="size-10 text-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{category.name}</span>
          {category.is_archived && <span className="block text-sm text-muted">Hidden when adding</span>}
        </span>
      </button>
      <span
        onPointerDown={(e) => controls.start(e)}
        className="grid h-14 w-12 shrink-0 cursor-grab touch-none place-items-center text-subtle"
        aria-label={`Reorder ${category.name}`}
      >
        <GripVertical className="size-5" />
      </span>
    </Reorder.Item>
  );
}
