"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Skipped in dev: a caching worker makes hot reload confusing. Set NEXT_PUBLIC_SW_IN_DEV=1 to test it.
const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_IN_DEV === "1";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;

    // Reload only after the user asked for the update. The first install also fires
    // `controllerchange` (clients.claim), and reloading then would wipe what they're typing.
    let updateRequested = false;
    const onControllerChange = () => {
      if (!updateRequested) return;
      updateRequested = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (worker: ServiceWorker) => {
      toast("A new version is ready", {
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        // Only prompt when an older worker is already in control (i.e. not the first install).
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(worker);
            }
          });
        });
      })
      .catch((error) => console.error("Service worker registration failed", error));

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
