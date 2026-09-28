"use client";

import { Download, X } from "lucide-react";
import { useState } from "react";
import { useExpenseCount } from "@/lib/db/queries";
import { useInstallState } from "@/lib/pwa/install";
import { InstallHelpSheet } from "@/components/settings/install-row";

const DISMISS_KEY = "install-card-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Nudges installing once the user has logged a few expenses (not on first visit). */
export function InstallCard() {
  const state = useInstallState();
  const count = useExpenseCount() ?? 0;
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [helpOpen, setHelpOpen] = useState(false);

  if (dismissed || count < 3 || (state.kind !== "prompt" && state.kind !== "ios")) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-card border border-line bg-surface p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
          <Download className="size-5" />
        </span>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={async () => (state.kind === "ios" ? setHelpOpen(true) : (await state.install()) && dismiss())}
        >
          <span className="block text-[15px] font-semibold">Add to your home screen</span>
          <span className="block text-sm text-muted">Opens like an app, works offline.</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid size-8 place-items-center text-subtle"
        >
          <X className="size-4" />
        </button>
      </div>
      <InstallHelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
