"use client";

import { useCallback, useSyncExternalStore } from "react";

// A per-device preference in localStorage (e.g. which number Home shows). Safe for SSR:
// the server and first render use the fallback, then it switches to the stored value.

const EVENT = "local-preference";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalPreference<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    (callback) => {
      window.addEventListener(EVENT, callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener(EVENT, callback);
        window.removeEventListener("storage", callback);
      };
    },
    () => (read(key) as T | null) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
