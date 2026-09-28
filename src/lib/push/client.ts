"use client";

// Browser side of web push. iOS supports it only in the installed (home-screen) app, 16.4+.

export type PushSupport = "supported" | "needs-install" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const standalone =
    matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return ios && !standalone ? "needs-install" : "unsupported";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  // The worker is only registered in production builds (see ServiceWorkerRegister).
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
  if (!reg) throw new Error("Notifications work in the installed app (production build).");
  return reg;
}

export async function currentSubscription() {
  if (pushSupport() !== "supported") return null;
  const reg = await registration().catch(() => null);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks permission (must run from a tap), subscribes this device and saves it on the server. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
  const reg = await registration();
  let subscription: PushSubscription;
  try {
    subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      }));
  } catch {
    // Browser/push-service messages ("Registration failed - …") aren't meaningful to people.
    throw new Error("This browser couldn't turn on notifications. Try the installed app, or another browser.");
  }
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Couldn't save this device. Try again.");
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export async function sendTestPush(): Promise<number> {
  const response = await fetch("/api/notifications/test", { method: "POST" });
  if (!response.ok) throw new Error("Couldn't send a test notification.");
  return ((await response.json()) as { delivered: number }).delivered;
}
