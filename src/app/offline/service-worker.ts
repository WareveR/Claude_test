import { registerSW } from "virtual:pwa-register";

/**
 * Installs the service worker that keeps the app shell for offline use. A new version waits
 * until every window of the app is closed, so it applies on the next open.
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  registerSW({ immediate: true });
}
