"use client";

import { Download, Plus, Share } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useInstallState } from "@/lib/pwa/install";
import { SettingsRow } from "./settings-group";

export function InstallRow() {
  const state = useInstallState();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  if (state.kind === "installed" || state.kind === "unsupported") return null;

  async function onClick() {
    if (state.kind === "ios") return setIosHelpOpen(true);
    if (state.kind === "prompt" && (await state.install())) toast.success("Installed! Find it on your home screen.");
  }

  return (
    <>
      <SettingsRow
        icon={<Download className="size-[18px]" />}
        label="Install app"
        hint="Add to your home screen for the full experience"
        onClick={onClick}
      />
      <InstallHelpSheet open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </>
  );
}

/** iOS has no install API: show the Share → Add to Home Screen steps. */
export function InstallHelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add to Home Screen">
      <ol className="space-y-4">
        <Step n={1}>
          Tap <Share className="mx-1 inline size-5 align-text-bottom" aria-label="Share" /> <b>Share</b> in
          Safari&apos;s toolbar.
        </Step>
        <Step n={2}>
          Scroll down and tap <Plus className="mx-1 inline size-5 align-text-bottom" aria-hidden />
          <b>Add to Home Screen</b>.
        </Step>
        <Step n={3}>
          Tap <b>Add</b>. Then open the app from your home screen.
        </Step>
      </ol>
      <Button variant="secondary" size="lg" className="mt-8 w-full" onClick={() => onOpenChange(false)}>
        Done
      </Button>
    </Sheet>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-bg">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
