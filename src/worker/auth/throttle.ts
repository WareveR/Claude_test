import { inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";

/** Wrong attempts allowed from one client IP before each further attempt has to wait. */
export const FREE_ATTEMPTS = 5;
/**
 * Wrong attempts allowed against one Account (or the setup code) from anywhere. Higher than per
 * IP, so a stranger can't lock someone out as easily, yet guessing from many IPs still slows down.
 */
export const FREE_ATTEMPTS_PER_TARGET = 10;
const MAX_WAIT_SECONDS = 15 * 60;
const MAX_EMAIL_LENGTH = 254;

/** Seconds to wait after `failures` wrong attempts: 1, 2, 4, … up to 15 minutes. */
export function waitSeconds(failures: number, free = FREE_ATTEMPTS): number {
  if (failures < free) return 0;
  return Math.min(2 ** (failures - free), MAX_WAIT_SECONDS);
}

export function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

/**
 * What a wrong attempt is counted against besides the IP. Never the whole Family, so failures
 * aimed at one Account can't stop the others from signing in.
 */
export const target = {
  /** Sign-in: the email typed, whether or not it has an Account, so nothing leaks. */
  email: (email: string) => `email:${email.slice(0, MAX_EMAIL_LENGTH)}`,
  /** A password check by someone already signed in. */
  account: (accountId: string) => `account:${accountId}`,
  /** The setup code: one secret for the Family, so its guesses count together. */
  setup: "setup",
};

function keys(ip: string, targetKey: string) {
  return [`ip:${ip}`, targetKey];
}

function freeAttempts(key: string) {
  return key.startsWith("ip:") ? FREE_ATTEMPTS : FREE_ATTEMPTS_PER_TARGET;
}

/** Returns how many seconds the caller must still wait, or 0 when it may try now. */
export async function retryAfter(
  db: Db,
  ip: string,
  targetKey: string,
  now: Date,
): Promise<number> {
  const rows = await db
    .select()
    .from(schema.signInThrottle)
    .where(inArray(schema.signInThrottle.key, keys(ip, targetKey)));
  let wait = 0;
  for (const row of rows) {
    const readyAt =
      Date.parse(row.lastFailureAt) + waitSeconds(row.failures, freeAttempts(row.key)) * 1000;
    wait = Math.max(wait, Math.ceil((readyAt - now.getTime()) / 1000));
  }
  return wait;
}

export async function recordFailure(
  db: Db,
  ip: string,
  targetKey: string,
  now: Date,
): Promise<void> {
  const at = now.toISOString();
  const count = (key: string) =>
    db
      .insert(schema.signInThrottle)
      .values({ key, failures: 1, lastFailureAt: at })
      .onConflictDoUpdate({
        target: schema.signInThrottle.key,
        set: { failures: sql`${schema.signInThrottle.failures} + 1`, lastFailureAt: at },
      });
  const [ipKey, other] = keys(ip, targetKey);
  await db.batch([count(ipKey), count(other)]);
}

export async function clearFailures(db: Db, ip: string, targetKey: string): Promise<void> {
  await db
    .delete(schema.signInThrottle)
    .where(inArray(schema.signInThrottle.key, keys(ip, targetKey)));
}
