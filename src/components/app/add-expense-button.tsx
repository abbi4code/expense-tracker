"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useExpenseSheet } from "@/components/expenses/expense-sheet";
import { useHiddenWhileScrollingDown } from "@/lib/use-scroll-direction";
import { cn } from "@/lib/utils";

/** Floating "+" in the thumb zone. Slides away while scrolling down so it never hides content. */
export function AddExpenseButton() {
  const { openAdd } = useExpenseSheet();
  const hidden = useHiddenWhileScrollingDown();
  // A group screen has its own "+" (adds a group expense).
  if (/^\/groups\/[^/]+/.test(usePathname())) return null;

  return (
    <button
      type="button"
      onClick={() => openAdd()}
      aria-label="Add expense"
      className={cn(
        "fixed right-5 z-30 grid size-15 place-items-center rounded-full bg-ink text-bg shadow-xl shadow-black/20 transition duration-300 active:scale-90 min-[560px]:right-[calc(50%-15rem)]",
        hidden && "pointer-events-none translate-y-24 opacity-0",
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4rem + 1rem)" }}
    >
      <Plus className="size-7" strokeWidth={2.25} />
    </button>
  );
}
