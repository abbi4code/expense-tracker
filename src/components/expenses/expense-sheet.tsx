"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import type { Expense } from "@/lib/db/local";
import { useQuickEntryParser } from "@/lib/use-quick-entry";
import { ExpenseForm, type ExpensePrefill } from "./expense-form";

type ExpenseSheetApi = { openAdd: (prefill?: ExpensePrefill) => void; openEdit: (expense: Expense) => void };

const ExpenseSheetContext = createContext<ExpenseSheetApi | null>(null);

type State = { open: boolean; expense: Expense | null; prefill?: ExpensePrefill; version: number };

/** One Add/Edit sheet for the whole app; any screen can open it. */
export function ExpenseSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ open: false, expense: null, version: 0 });

  const openAdd = useCallback(
    (prefill?: ExpensePrefill) => setState((s) => ({ open: true, expense: null, prefill, version: s.version + 1 })),
    [],
  );
  const openEdit = useCallback(
    (expense: Expense) => setState((s) => ({ open: true, expense, version: s.version + 1 })),
    [],
  );
  const api = useMemo(() => ({ openAdd, openEdit }), [openAdd, openEdit]);
  const close = () => setState((s) => ({ ...s, open: false }));

  return (
    <ExpenseSheetContext.Provider value={api}>
      {children}
      <Suspense>
        <ShortcutOpener onOpen={openAdd} />
      </Suspense>
      <Sheet
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
        title={state.expense ? "Edit expense" : "Add expense"}
        hideTitle
      >
        {/* Re-keyed on every open so the form starts fresh. */}
        <ExpenseForm key={state.version} expense={state.expense} prefill={state.prefill} onDone={close} />
      </Sheet>
    </ExpenseSheetContext.Provider>
  );
}

/**
 * Opens the Add sheet for `?add=1` (home-screen shortcut, first run) and for text shared to
 * the app (Android share target: `?share=1&text=…`), prefilled from the shared message.
 */
function ShortcutOpener({ onOpen }: { onOpen: (prefill?: ExpensePrefill) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { ready, parseShared } = useQuickEntryParser();
  const add = searchParams.get("add") === "1";
  const shared = searchParams.get("share") === "1";
  const sharedText = [searchParams.get("title"), searchParams.get("text"), searchParams.get("url")]
    .filter(Boolean)
    .join(" ");

  // Handle each link once: this effect re-runs as data loads, while the URL still has the params.
  const handled = useRef<string | null>(null);
  const key = searchParams.toString();

  useEffect(() => {
    if (!add && !shared) return;
    if (shared && !ready) return; // wait for categories to match against
    if (handled.current === key) return;
    handled.current = key;
    router.replace(pathname, { scroll: false });
    onOpen(shared ? parseShared(sharedText) : undefined);
  }, [add, shared, ready, key, sharedText, parseShared, router, pathname, onOpen]);

  return null;
}

export function useExpenseSheet() {
  const api = useContext(ExpenseSheetContext);
  if (!api) throw new Error("useExpenseSheet must be used inside <ExpenseSheetProvider>");
  return api;
}
