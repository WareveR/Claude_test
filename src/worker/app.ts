import { Hono } from "hono";
import { getDb, schema } from "./db";

export const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", async (c) => {
  const db = getDb(c.env.DB);
  const families = await db.select({ id: schema.family.id }).from(schema.family).limit(1);
  return c.json({ status: "ok", familyExists: families.length > 0 });
});
