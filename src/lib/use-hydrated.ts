import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during SSR and hydration, true once React is interactive on the client. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
