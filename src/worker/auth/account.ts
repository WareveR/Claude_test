import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";

export type Account = typeof schema.account.$inferSelect;

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails are compared and kept in lower case. */
export function normalEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** The Account with this email, removed or not: an email stays taken while its Account can be restored. */
export async function accountByEmail(db: Db, email: string): Promise<Account | undefined> {
  if (!email) return undefined;
  const [account] = await db.select().from(schema.account).where(eq(schema.account.email, email));
  return account;
}

/** The Account that may sign in or recover its password with this email: not a removed one. */
export async function activeAccountByEmail(db: Db, email: string) {
  const account = await accountByEmail(db, email);
  return account && !account.removedAt ? account : undefined;
}

/** The Account that created the Family; there is exactly one once the Family exists. */
export async function ownerAccount(db: Db): Promise<Account | undefined> {
  const [owner] = await db.select().from(schema.account).where(eq(schema.account.role, "owner"));
  return owner;
}
