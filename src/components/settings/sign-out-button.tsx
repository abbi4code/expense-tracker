"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { deleteLocalDB } from "@/lib/db/local";
import { writeCachedSession } from "@/lib/session-cache";
import { createClient } from "@/lib/supabase/client";

/** Signs out and wipes this user's data from the device (local DB + cached pages). */
export async function clearDeviceData(userId: string) {
  writeCachedSession(null);
  await deleteLocalDB(userId);
  if ("caches" in window) await Promise.all([caches.delete("pages"), caches.delete("pages-warm")]);
}

export function SignOutButton() {
  const router = useRouter();
  const { db, sync } = useData();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await sync(); // push anything still pending before the local copy is wiped
    await createClient().auth.signOut();
    await clearDeviceData(db.userId);
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" size="lg" className="w-full" loading={loading} onClick={signOut}>
      Sign out
    </Button>
  );
}
