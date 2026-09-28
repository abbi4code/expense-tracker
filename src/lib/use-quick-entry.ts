"use client";

import { useCallback } from "react";
import { todayISO } from "@/lib/dates";
import { useCategories, useNoteSuggestions, usePaymentMethods } from "@/lib/db/queries";
import { parseQuickEntry, parseSharedText, type QuickEntryContext } from "@/lib/quick-entry";

/** Parsers bound to the user's categories, payment methods and past notes. */
export function useQuickEntryParser() {
  const categories = useCategories();
  const paymentMethods = usePaymentMethods();
  const noteHistory = useNoteSuggestions();
  const ready = Boolean(categories && paymentMethods && noteHistory);

  const context = useCallback(
    (): QuickEntryContext => ({
      today: todayISO(),
      categories: (categories ?? []).filter((c) => !c.is_archived),
      paymentMethods: paymentMethods ?? [],
      noteHistory: noteHistory ?? new Map(),
    }),
    [categories, paymentMethods, noteHistory],
  );

  return {
    ready,
    parse: useCallback((text: string) => parseQuickEntry(text, context()), [context]),
    parseShared: useCallback((text: string) => parseSharedText(text, context()), [context]),
  };
}
