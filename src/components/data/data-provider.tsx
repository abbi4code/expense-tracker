"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { openLocalDB, type LocalDB } from "@/lib/db/local";
import { addDueRecurringExpenses, setSyncRequester, syncGroupShares, updateProfile } from "@/lib/db/mutations";
import { kindOf } from "@/lib/db/local";
import { parseQuickEntry } from "@/lib/quick-entry";
import { todayISO } from "@/lib/dates";
import { SyncEngine } from "@/lib/db/sync";
import { createClient } from "@/lib/supabase/client";

type DataContextValue = { db: LocalDB; sync: () => Promise<void> };

const DataContext = createContext<DataContextValue | null>(null);

const PULL_INTERVAL_MS = 60_000;

/** Opens the signed-in user's on-device DB and keeps it in sync with Supabase. */
export function DataProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const db = useMemo(() => openLocalDB(userId), [userId]);
  const engine = useMemo(() => new SyncEngine(db, createClient(), (_item, message) => toast.error(message)), [db]);

  useEffect(() => {
    // After syncing (so rules are up to date), add any recurring bills that have come due.
    const sync = async () => {
      await engine.sync();
      if (!(await db.meta.get("initialSyncDone"))?.value) return;
      await addDueRecurringExpenses(db);
      // Your share of group expenses → personal expenses (category guessed from the description).
      const categories = (await db.categories.toArray()).filter((c) => !c.deleted_at && kindOf(c) === "expense");
      const fallback = categories.find((c) => c.name === "Other")?.id ?? categories[0]?.id ?? null;
      await syncGroupShares(
        db,
        (description) =>
          parseQuickEntry(description, { today: todayISO(), categories, paymentMethods: [], noteHistory: new Map() })
            .categoryId ?? fallback,
      );
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Batch bursts of writes (e.g. moving many expenses) into one push.
    setSyncRequester(() => {
      clearTimeout(timer);
      // The full cycle (push, pull, then recurring bills + group shares), not just the engine.
      timer = setTimeout(sync, 250);
    });

    // Reminders are sent at the user's local hour, so keep the time zone current (e.g. after travel).
    db.profiles.get(db.userId).then((profile) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (profile && profile.timezone !== timezone) updateProfile(db, { timezone });
    });

    // Ask the service worker (production only) to cache every tab for offline use.
    navigator.serviceWorker?.ready.then((registration) =>
      registration.active?.postMessage({ type: "WARM_PAGES", urls: ["/home", "/activity", "/insights", "/settings"] }),
    );

    const syncIfVisible = () => document.visibilityState === "visible" && sync();
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", syncIfVisible);
    const interval = setInterval(syncIfVisible, PULL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", syncIfVisible);
      setSyncRequester(() => {});
    };
  }, [db, engine]);

  const value = useMemo(() => ({ db, sync: engine.sync }), [db, engine]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside <DataProvider>");
  return value;
}
