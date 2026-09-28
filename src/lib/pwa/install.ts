"use client";

import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome/Android fire `beforeinstallprompt` once, possibly before any component mounts,
// so it is captured at module load and kept in a tiny store.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as Mac; touch support gives it away.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "prompt"; install: () => Promise<boolean> } // Android / desktop Chromium
  | { kind: "ios" } // needs manual Share → Add to Home Screen
  | { kind: "unsupported" };

const serverState: InstallState = { kind: "unsupported" };

function computeState(): InstallState {
  if (isStandalone()) return { kind: "installed" };
  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    return {
      kind: "prompt",
      install: async () => {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        deferredPrompt = null;
        notify();
        return outcome === "accepted";
      },
    };
  }
  if (isIOS()) return { kind: "ios" };
  return { kind: "unsupported" };
}

// useSyncExternalStore needs a stable snapshot between changes.
let cachedPrompt: BeforeInstallPromptEvent | null | undefined;
let cachedState: InstallState = serverState;
function getSnapshot() {
  if (cachedPrompt !== deferredPrompt || cachedState === serverState) {
    cachedPrompt = deferredPrompt;
    cachedState = computeState();
  }
  return cachedState;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}
