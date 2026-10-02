import type { PushSubscriptionJson } from "./db/schema";

/**
 * Web Push with VAPID (RFC 8292) and an aes128gcm-encrypted payload (RFC 8291), on WebCrypto
 * alone. The keys are Worker secrets: VAPID_PUBLIC_KEY (the raw P-256 point) and
 * VAPID_PRIVATE_KEY (its "d"), both base64url, and VAPID_SUBJECT ("mailto:…").
 */

const encoder = new TextEncoder();

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmac(key: BufferSource, data: BufferSource) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/** The VAPID keys, or null when the Worker has none (Reminders are then off). */
export function vapidKeys(env: Env): VapidKeys | null {
  const vars = env as unknown as Record<string, string | undefined>;
  const publicKey = vars.VAPID_PUBLIC_KEY;
  const privateKey = vars.VAPID_PRIVATE_KEY;
  const subject = vars.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** The `Authorization: vapid t=…, k=…` header for one push service, valid 12 hours. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now: Date) {
  const point = fromBase64Url(keys.publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(point.slice(1, 33)),
      y: toBase64Url(point.slice(33, 65)),
      d: keys.privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${toBase64Url(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

/** Encrypts a payload for one subscription as one aes128gcm record (RFC 8291). */
export async function encryptPayload(subscription: PushSubscriptionJson, payload: string) {
  const uaPublic = fromBase64Url(subscription.keys.p256dh);
  const authSecret = fromBase64Url(subscription.keys.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer,
  );
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // workers-types names it `$public`; the runtime wants `public`.
      { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      local.privateKey,
      256,
    ),
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, encoder.encode("Content-Encoding: aes128gcm\0\x01"))).slice(0, 16);
  const nonce = (await hmac(prk, encoder.encode("Content-Encoding: nonce\0\x01"))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record: the payload, then the 0x02 "last record" delimiter.
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plaintext),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export type PushMessage = { title: string; url: string; tag: string };

/** The push service's answer: `gone` means the subscription expired and should be removed. */
export type PushResult = { ok: boolean; gone: boolean };

/** Where pushes go. Tests swap `send` for a fake. */
export const pusher = {
  async send(
    env: Env,
    subscription: PushSubscriptionJson,
    message: PushMessage,
    now: Date,
  ): Promise<PushResult> {
    const keys = vapidKeys(env);
    if (!keys) return { ok: false, gone: false };
    const body = await encryptPayload(subscription, JSON.stringify(message));
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization(subscription.endpoint, keys, now),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        // A Reminder an hour late is no longer worth showing.
        TTL: "3600",
        Urgency: "high",
      },
      body,
    });
    return { ok: res.ok, gone: res.status === 404 || res.status === 410 };
  },
};
