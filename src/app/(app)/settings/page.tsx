import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <SettingsScreen email={data?.claims.email as string | undefined} />;
}
