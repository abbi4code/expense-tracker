"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { usePendingChanges } from "@/lib/db/queries";
import { useOnline } from "@/lib/use-online";

/** Small status pill: offline, or changes waiting to sync. Hidden when all is synced. */
export function SyncStatus() {
  const online = useOnline();
  const pending = usePendingChanges() ?? 0;

  if (online && pending === 0) return null;
  return (
    <span
      role="status"
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-medium text-muted"
    >
      {online ? <RefreshCw className="size-3.5 animate-spin" /> : <CloudOff className="size-3.5" />}
      {online ? "Syncing" : pending ? `Offline · ${pending} to sync` : "Offline"}
    </span>
  );
}
