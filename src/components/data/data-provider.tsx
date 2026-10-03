"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { todayISO } from "@/lib/dates";
import { kindOf, openLocalDB, type LocalDB } from "@/lib/db/local";
import {
  addDueGroupOccurrences,
  addDueRecurringExpenses,
  setSyncRequester,
  syncGroupShares,
  updateProfile,
} from "@/lib/db/mutations";
import { SyncEngine } from "@/lib/db/sync";
import { parseQuickEntry } from "@/lib/quick-entry";
import {
  readCachedSessionRaw,
  subscribeCachedSession,
  writeCachedSession,
  type CachedSession,
} from "@/lib/session-cache";
import { createClient } from "@/lib/supabase/client";

type DataContextValue = { db: LocalDB; sync: () => Promise<void>; email: string | null };

const DataContext = createContext<DataContextValue | null>(null);

const PULL_INTERVAL_MS = 60_000;

/**
 * Opens the signed-in user's on-device DB and keeps it in sync with Supabase.
 *
 * The app's pages are static and render entirely from this local data, so there's no server
 * round trip per page. The account comes from the device's last session (instant, works
 * offline) and is confirmed with Supabase in the background; signed-out users go to /login.
 */
export function DataProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const cachedRaw = useSyncExternalStore(subscribeCachedSession, readCachedSessionRaw, () => null);
  const cached = useMemo(() => (cachedRaw ? (JSON.parse(cachedRaw) as CachedSession) : null), [cachedRaw]);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data, error }) => {
        const user = data.session?.user;
        if (user) {
          if (user.id !== cached?.userId || (user.email ?? null) !== cached?.email) {
            writeCachedSession({ userId: user.id, email: user.email ?? null });
          }
          return;
        }
        // Offline (or Supabase unreachable) with an expired token: keep working on local data.
        if ((!navigator.onLine || error) && cached) return;
        writeCachedSession(null);
        window.location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      });
    // Only on first load; later sign-outs go through the Sign out button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cached) return fallback;
  return (
    <UserData key={cached.userId} userId={cached.userId} email={cached.email}>
      {children}
    </UserData>
  );
}

function UserData({ userId, email, children }: { userId: string; email: string | null; children: React.ReactNode }) {
  const router = useRouter();
  const db = useMemo(() => openLocalDB(userId), [userId]);
  const engine = useMemo(() => new SyncEngine(db, createClient(), (_item, message) => toast.error(message)), [db]);
  // First-run setup check, only after a sync in this session (so a stale local copy can't bounce
  // someone back to setup they just finished).
  const [syncedNow, setSyncedNow] = useState(false);
  const profile = useLiveQuery(() => db.profiles.get(userId), [db, userId]);

  useEffect(() => {
    if (syncedNow && profile && !profile.onboarded_at) router.replace("/welcome");
  }, [syncedNow, profile, router]);

  useEffect(() => {
    // After syncing (so rules are up to date), add any recurring bills that have come due.
    const sync = async () => {
      await engine.sync();
      setSyncedNow(true);
      if (!(await db.meta.get("initialSyncDone"))?.value) return;
      await addDueRecurringExpenses(db);
      // Months that came due for repeating group expenses (rent…), before mirroring shares.
      await addDueGroupOccurrences(db);
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
      registration.active?.postMessage({
        type: "WARM_PAGES",
        urls: ["/home", "/activity", "/insights", "/groups", "/settings"],
      }),
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

  const value = useMemo(() => ({ db, sync: engine.sync, email }), [db, engine, email]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside <DataProvider>");
  return value;
}
