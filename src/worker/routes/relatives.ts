import { eq, isNotNull, or } from "drizzle-orm";
import { Hono } from "hono";
import {
  isDescendant,
  parseTreeDate,
  SEXES,
  type Relative,
  type Sex,
} from "../../core/family-tree";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const LIMITS = { name: 80, nickname: 80, birthPlace: 120, notes: 4000 } as const;

type Fields = Partial<
  Pick<
    Relative,
    "name" | "nickname" | "sex" | "birthDate" | "deathDate" | "birthPlace" | "photoKey" | "notes"
  >
>;

/** Validates the fields present; returns the bad field's name or the clean values. */
function parseFields(body: Record<string, unknown>, partial: boolean) {
  const out: Fields = {};
  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > LIMITS.name) return { field: "name" };
    out.name = name;
  }
  for (const field of ["nickname", "birthPlace", "notes"] as const) {
    if (!(field in body)) continue;
    const value = body[field];
    if (typeof value !== "string" || value.trim().length > LIMITS[field]) return { field };
    out[field] = value.trim();
  }
  if ("sex" in body) {
    if (!SEXES.includes(body.sex as Sex)) return { field: "sex" };
    out.sex = body.sex as Sex;
  }
  for (const field of ["birthDate", "deathDate"] as const) {
    if (!(field in body)) continue;
    const date = parseTreeDate(body[field]);
    if (date === undefined) return { field };
    out[field] = date;
  }
  if ("photoKey" in body) {
    if (body.photoKey !== null && typeof body.photoKey !== "string") return { field: "photoKey" };
    out.photoKey = body.photoKey as string | null;
  }
  return { values: out };
}

function idList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string")) {
    return undefined;
  }
  return [...new Set(value)];
}

/** Every Relative with their parents and partners. */
export async function allRelatives(db: Db): Promise<Relative[]> {
  const [rows, parents, partners] = await Promise.all([
    db.select().from(schema.relative).orderBy(schema.relative.createdAt),
    db.select().from(schema.relativeParent),
    db.select().from(schema.relativePartner),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nickname: r.nickname,
    sex: r.sex as Sex,
    birthDate: r.birthDate,
    deathDate: r.deathDate,
    birthPlace: r.birthPlace,
    photoKey: r.photoKey,
    notes: r.notes,
    parentIds: parents.filter((p) => p.childId === r.id).map((p) => p.parentId),
    partnerIds: partners
      .filter((p) => p.aId === r.id || p.bId === r.id)
      .map((p) => (p.aId === r.id ? p.bId : p.aId)),
  }));
}

/**
 * Checks the links a Relative is saved with against the whole tree as it would be: known ids,
 * at most two parents each, and nobody their own ancestor.
 */
function checkLinks(
  tree: Relative[],
  id: string,
  links: { parentIds?: string[]; partnerIds?: string[]; childIds?: string[] },
) {
  const known = new Set(tree.map((r) => r.id));
  const all = [...(links.parentIds ?? []), ...(links.partnerIds ?? []), ...(links.childIds ?? [])];
  if (all.some((x) => x === id || !known.has(x))) return "links";
  const next = tree.map((r) => {
    if (r.id === id) return { ...r, parentIds: links.parentIds ?? r.parentIds };
    if (links.childIds?.includes(r.id)) return { ...r, parentIds: [...r.parentIds, id] };
    return r;
  });
  if (next.some((r) => r.parentIds.length > 2)) return "parentIds";
  const me = next.find((r) => r.id === id)!;
  if (me.parentIds.some((p) => isDescendant(next, id, p))) return "parentIds";
  if ((links.partnerIds ?? []).some((p) => me.parentIds.includes(p))) return "partnerIds";
  return null;
}

function pair(a: string, b: string) {
  return a < b ? { aId: a, bId: b } : { aId: b, bId: a };
}

/** The Family Tree: Relatives, their parents and their partners. */
export const relativeRoutes = new Hono<AppEnv>().use(requireDevice);

relativeRoutes.get("/relatives", async (c) => c.json(await allRelatives(c.get("db"))));

/**
 * Adds a Relative with their parents and partners, and as parent of `childIds` (adding a
 * mother to someone already in the tree).
 */
relativeRoutes.post("/relatives", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const links = {
    parentIds: idList(body.parentIds ?? []),
    partnerIds: idList(body.partnerIds ?? []),
    childIds: idList(body.childIds ?? []),
  };
  for (const [field, value] of Object.entries(links)) {
    if (!value) return c.json({ error: "invalid", field }, 400);
  }
  const id = randomId();
  const now = c.get("now").toISOString();
  const draft: Relative = {
    id,
    nickname: "",
    sex: "",
    birthDate: null,
    deathDate: null,
    birthPlace: "",
    photoKey: null,
    notes: "",
    ...parsed.values,
    name: parsed.values.name!,
    parentIds: [],
    partnerIds: [],
  };
  const bad = checkLinks([...(await allRelatives(db)), draft], id, links);
  if (bad) return c.json({ error: "invalid", field: bad }, 400);
  await db.batch([
    db.insert(schema.relative).values({ ...draft, createdAt: now, changedAt: now }),
    ...links.parentIds!.map((parentId) =>
      db.insert(schema.relativeParent).values({ childId: id, parentId }),
    ),
    ...links.childIds!.map((childId) =>
      db.insert(schema.relativeParent).values({ childId, parentId: id }),
    ),
    ...links.partnerIds!.map((p) => db.insert(schema.relativePartner).values(pair(id, p))),
  ]);
  const saved = (await allRelatives(db)).find((r) => r.id === id);
  return c.json(saved, 201);
});

/** Changes a Relative's details; `parentIds` and `partnerIds`, when given, replace theirs. */
relativeRoutes.patch("/relatives/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, true);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const parentIds = body.parentIds === undefined ? undefined : idList(body.parentIds);
  const partnerIds = body.partnerIds === undefined ? undefined : idList(body.partnerIds);
  if (body.parentIds !== undefined && !parentIds)
    return c.json({ error: "invalid", field: "parentIds" }, 400);
  if (body.partnerIds !== undefined && !partnerIds) {
    return c.json({ error: "invalid", field: "partnerIds" }, 400);
  }
  const tree = await allRelatives(db);
  if (!tree.some((r) => r.id === id)) return c.json({ error: "not_found" }, 404);
  const bad = checkLinks(tree, id, { parentIds, partnerIds });
  if (bad) return c.json({ error: "invalid", field: bad }, 400);
  const now = c.get("now").toISOString();
  await db.batch([
    db
      .update(schema.relative)
      .set({ ...parsed.values, changedAt: now })
      .where(eq(schema.relative.id, id)),
    ...(parentIds
      ? [
          db.delete(schema.relativeParent).where(eq(schema.relativeParent.childId, id)),
          ...parentIds.map((parentId) =>
            db.insert(schema.relativeParent).values({ childId: id, parentId }),
          ),
        ]
      : []),
    ...(partnerIds
      ? [
          db
            .delete(schema.relativePartner)
            .where(or(eq(schema.relativePartner.aId, id), eq(schema.relativePartner.bId, id))),
          ...partnerIds.map((p) => db.insert(schema.relativePartner).values(pair(id, p))),
        ]
      : []),
  ]);
  return c.json((await allRelatives(db)).find((r) => r.id === id));
});

/** Deleting is for good; their children and partners stay, without the link. */
relativeRoutes.delete("/relatives/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const deleted = await db
    .delete(schema.relative)
    .where(eq(schema.relative.id, id))
    .returning({ id: schema.relative.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  // Foreign keys may be off in D1; remove the links too.
  await db.batch([
    db
      .delete(schema.relativeParent)
      .where(or(eq(schema.relativeParent.childId, id), eq(schema.relativeParent.parentId, id))),
    db
      .delete(schema.relativePartner)
      .where(or(eq(schema.relativePartner.aId, id), eq(schema.relativePartner.bId, id))),
  ]);
  return c.body(null, 204);
});

/** Photos still shown in the tree, for the nightly image clean-up. */
export async function relativePhotoKeys(db: Db): Promise<string[]> {
  const rows = await db
    .select({ key: schema.relative.photoKey })
    .from(schema.relative)
    .where(isNotNull(schema.relative.photoKey));
  return rows.map((r) => r.key!);
}
