"use client";

// Which account this device last used, so the installed app can open on its local data at once
// (no waiting for the network) and keep working offline after the auth token expires.
// The real session is still checked in the background; this only picks the on-device database.

const KEY = "last-session";
const EVENT = "last-session-change";

export type CachedSession = { userId: string; email: string | null };

export function readCachedSessionRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeCachedSession(session: CachedSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeCachedSession(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
