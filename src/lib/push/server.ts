import "server-only";
import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:you@example.com", publicKey, privateKey);
  configured = true;
}

type Subscription = { endpoint: string; p256dh: string; auth: string };

/** Sends to every device of a user; subscriptions the browser has revoked are deleted. */
export async function sendToSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  subscriptions: Subscription[],
  message: PushMessage,
) {
  configure();
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 6, urgency: "normal" },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        else console.error("Push failed", status, (error as Error).message);
      }
    }),
  );
  return sent;
}
