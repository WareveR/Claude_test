import { useSignedIn } from "./family";

/**
 * Whether this device sees the tools for testing and diagnosing the app (Settings › App version ›
 * Tests and diagnostics, and any added later): when its Account has Dev on.
 */
export function useDevTools(): boolean {
  return useSignedIn().account.dev;
}
