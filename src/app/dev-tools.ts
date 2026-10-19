/**
 * Whether this device sees the tools for testing and diagnosing the app (Settings › App version ›
 * Tests and diagnostics, and any added later). Every device for now; it becomes a permission once
 * the Family has accounts with roles.
 */
export function useDevTools(): boolean {
  return true;
}
