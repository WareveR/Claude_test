import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

let waiting = false;
let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

/**
 * Installs the service worker that keeps the app shell for offline use. A new version waits
 * until every window of the app is closed, so it applies on the next open (a Display Mode
 * tablet applies it overnight).
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      for (const listener of listeners) listener();
    },
  });
}

/** Whether a new version of the app is waiting to be applied. */
export function useUpdateWaiting(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => waiting,
    () => false,
  );
}

/** Activates the waiting version and reloads the page. */
export function applyUpdate() {
  if (update) void update(true);
}
