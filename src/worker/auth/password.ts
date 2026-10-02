import { fromBase64Url, safeEqual, toBase64Url } from "./crypto";

/** The highest PBKDF2 iteration count the Workers runtime accepts. */
export const PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSWORD_LENGTH = 10;

const encoder = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

/** Hashes the Family Password as "pbkdf2-sha256$<iterations>$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, hash] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || !salt || !hash) return false;
  const candidate = await derive(password, fromBase64Url(salt), Number(iterations));
  return safeEqual(candidate, hash);
}

export function isAcceptablePassword(password: unknown): password is string {
  return typeof password === "string" && [...password].length >= MIN_PASSWORD_LENGTH;
}
