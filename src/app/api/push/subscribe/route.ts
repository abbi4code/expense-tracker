import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub;
}

/**
 * Saves this device's push subscription for the signed-in user. Done server-side so that a
 * device previously used by another account is moved over (RLS would block updating their row).
 */
export async function POST(request: NextRequest) {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as Body;
  if (!body.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = (await request.json()) as Body;
  if (endpoint)
    await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
