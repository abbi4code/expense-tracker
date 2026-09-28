import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Bypasses RLS. Server-only: used by the notification scheduler and push subscription route. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
