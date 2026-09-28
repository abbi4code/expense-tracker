import { NextResponse } from "next/server";
import { sendToSubscriptions } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Sends a test notification to the signed-in user's devices. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  const delivered = await sendToSubscriptions(admin, subscriptions ?? [], {
    title: "Notifications are on 🎉",
    body: "We'll nudge you to log, remind you of bills and send a Sunday recap.",
    url: "/settings",
    tag: "test",
  });
  return NextResponse.json({ delivered });
}
