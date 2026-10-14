import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { isLanguage } from "../../core/languages";
import { MAX_PHRASES, MAX_TEXT, parseWritten } from "../../core/suggestions";
import { familyNow } from "../../core/task";
import { readSuggestions } from "../ai";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/**
 * Suggestions: the phrases written or said in the box become repeating Tasks and Entries to
 * review. Nothing is saved here; the browser creates the ones the Family keeps through the usual
 * routes. The model sees the phrases and the Persons' names and nicknames, never the calendar.
 */
export const suggestionRoutes = new Hono<AppEnv>().use(requireDevice);

suggestionRoutes.post("/suggestions/read", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const phrases: unknown = body.phrases;
  if (
    !Array.isArray(phrases) ||
    phrases.length === 0 ||
    phrases.length > MAX_PHRASES ||
    !phrases.every((p) => typeof p === "string" && p.trim()) ||
    (phrases as string[]).join("").length > MAX_TEXT
  ) {
    return c.json({ error: "invalid", field: "phrases" }, 400);
  }
  const db = c.get("db");
  const [[family], persons, nicknames] = await Promise.all([
    db.select().from(schema.family).limit(1),
    db.select().from(schema.person).where(eq(schema.person.archived, false)),
    db.select().from(schema.personNickname),
  ]);
  const deviceLanguage = c.get("device").language;
  const language = isLanguage(deviceLanguage)
    ? deviceLanguage
    : isLanguage(family.language)
      ? family.language
      : "pt-PT";
  const { today } = familyNow(family.timeZone, c.get("now"));
  const raw = await readSuggestions(
    c.env,
    (phrases as string[]).map((p) => p.trim()),
    today,
    language,
    persons.map((p) => ({
      name: p.name,
      nicknames: nicknames.filter((n) => n.personId === p.id).map((n) => n.nickname),
    })),
  );
  const items = parseWritten(
    raw,
    today,
    persons.map((p) => p.id),
  );
  return c.json(items ? { outcome: "read", items } : { outcome: "failed" });
});
