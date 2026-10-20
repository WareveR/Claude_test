import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";

export type Account = typeof schema.account.$inferSelect;

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails are compared and kept in lower case. */
export function normalEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function accountByEmail(db: Db, email: string): Promise<Account | undefined> {
  if (!email) return undefined;
  const [account] = await db.select().from(schema.account).where(eq(schema.account.email, email));
  return account;
}

/** The Account that created the Family; there is exactly one once the Family exists. */
export async function ownerAccount(db: Db): Promise<Account | undefined> {
  const [owner] = await db.select().from(schema.account).where(eq(schema.account.role, "owner"));
  return owner;
}
