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

/**
 * Settings › "Update now": asks the server for a newer version at once and, when there is one,
 * applies it and reloads, without waiting for every window of the app to close (an installed
 * app on Android often stays open in the background). Resolves to "latest" when there is none.
 */
export async function updateNow(): Promise<"updating" | "latest"> {
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (!registration) {
    location.reload();
    return "updating";
  }
  await registration.update().catch(() => {});
  const installing = registration.installing;
  if (installing) {
    await new Promise<void>((resolve) => {
      const settle = () => installing.state !== "installing" && resolve();
      installing.addEventListener("statechange", settle);
      setTimeout(resolve, 15_000);
    });
  }
  if (!registration.waiting) return "latest";
  if (update) void update(true);
  else registration.waiting.postMessage({ type: "SKIP_WAITING" });
  // Reload anyway if the new version takes control without telling this page.
  setTimeout(() => location.reload(), 4_000);
  return "updating";
}
