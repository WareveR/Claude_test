/**
 * A VAPID key as stored in a Worker secret, reduced to bare base64url. Pasting the line
 * `node scripts/vapid-keys.mjs` prints (`VAPID_PUBLIC_KEY=B…`), quotes, spaces or a trailing
 * newline into the secret made the browser's atob throw when allowing notifications.
 */
export function cleanVapidKey(value: string): string {
  const unquoted = value.trim().replace(/^["']|["']$/g, "");
  const withoutName = unquoted.replace(/^[A-Z_]+\s*=\s*/, "");
  return withoutName.replace(/[\s"'=]/g, "");
}

/** The bytes of a base64url (or base64) string, padded as atob needs. */
export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
