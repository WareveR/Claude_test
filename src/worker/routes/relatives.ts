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
    personId: r.personId,
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

/** An id the browser may give a new Relative, so that Voice Entry's Undo can find it. */
const ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Adds a Relative with their parents and partners, and as parent of `childIds` (adding a
 * mother to someone already in the tree). `id`, if given, names the new Relative.
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
  const id = body.id ?? randomId();
  if (typeof id !== "string" || !ID.test(id)) return c.json({ error: "invalid", field: "id" }, 400);
  const tree = await allRelatives(db);
  if (tree.some((r) => r.id === id)) return c.json({ error: "conflict" }, 409);
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
  const bad = checkLinks([...tree, draft], id, links);
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

export const RELATIONS = ["partner", "parent", "child", "sibling", "other"] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * The tree Relative a calendar Person is: the one already linked, else an unlinked one with the
 * same name, else a new one; the Person's photo and date of birth fill in what it lacks.
 */
async function relativeFor(db: Db, personId: string, now: string) {
  const [person] = await db.select().from(schema.person).where(eq(schema.person.id, personId));
  if (!person) return null;
  const tree = await allRelatives(db);
  const linked = tree.find((r) => r.personId === personId);
  if (linked) return linked.id;
  const name = person.name.trim().toLowerCase();
  const same = tree.find((r) => !r.personId && r.name.trim().toLowerCase() === name);
  if (same) {
    await db
      .update(schema.relative)
      .set({
        personId,
        photoKey: same.photoKey ?? person.photoKey,
        birthDate: same.birthDate ?? person.dateOfBirth,
        changedAt: now,
      })
      .where(eq(schema.relative.id, same.id));
    return same.id;
  }
  const id = randomId();
  await db.insert(schema.relative).values({
    id,
    name: person.name,
    personId,
    photoKey: person.photoKey,
    birthDate: person.dateOfBirth,
    createdAt: now,
    changedAt: now,
  });
  return id;
}

/** The parents to give `id` so it is `relation` of `other`, or the reason it can't be. */
function linksFor(tree: Relative[], id: string, other: string, relation: Relation) {
  const me = tree.find((r) => r.id === id)!;
  const them = tree.find((r) => r.id === other)!;
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  switch (relation) {
    case "partner":
      return { partner: true };
    case "parent":
      return { parentsOf: { [other]: union(them.parentIds, [id]) } };
    case "child": {
      // A child of someone with one partner is taken to be theirs too, room allowing.
      const both = them.partnerIds.length === 1 ? [other, them.partnerIds[0]] : [other];
      const parents = union(me.parentIds, both);
      return { parentsOf: { [id]: parents.length > 2 ? union(me.parentIds, [other]) : parents } };
    }
    case "sibling": {
      if (me.parentIds.some((p) => them.parentIds.includes(p))) return {};
      if (me.parentIds.length === 0 && them.parentIds.length > 0) {
        return { parentsOf: { [id]: them.parentIds } };
      }
      if (them.parentIds.length === 0 && me.parentIds.length > 0) {
        return { parentsOf: { [other]: me.parentIds } };
      }
      if (me.parentIds.length === 0) return { unknownParent: [id, other] };
      return { conflict: true };
    }
    case "other":
      return {};
  }
}

/**
 * "This Person is … of that one": links both into the Family Tree, as partners, parent and
 * child, or siblings (sharing parents, or an unknown parent added to both when neither has any).
 */
relativeRoutes.post("/persons/:id/relation", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const relation = body.relation as Relation;
  if (!RELATIONS.includes(relation)) return c.json({ error: "invalid", field: "relation" }, 400);
  const otherPerson = typeof body.personId === "string" ? body.personId : "";
  if (otherPerson === c.req.param("id"))
    return c.json({ error: "invalid", field: "personId" }, 400);
  if (relation === "other") return c.body(null, 204);
  const now = c.get("now").toISOString();
  const id = await relativeFor(db, c.req.param("id"), now);
  if (!id) return c.json({ error: "not_found" }, 404);
  const other = await relativeFor(db, otherPerson, now);
  if (!other) return c.json({ error: "invalid", field: "personId" }, 400);
  const tree = await allRelatives(db);
  const plan = linksFor(tree, id, other, relation);
  if ("conflict" in plan) return c.json({ error: "relation_conflict" }, 409);
  const steps = [];
  if ("partner" in plan && !tree.find((r) => r.id === id)!.partnerIds.includes(other)) {
    steps.push(db.insert(schema.relativePartner).values(pair(id, other)));
  }
  for (const [child, parentIds] of Object.entries(plan.parentsOf ?? {})) {
    const bad = checkLinks(tree, child, { parentIds });
    if (bad) return c.json({ error: "relation_conflict", field: bad }, 409);
    steps.push(
      db.delete(schema.relativeParent).where(eq(schema.relativeParent.childId, child)),
      ...parentIds.map((parentId) =>
        db.insert(schema.relativeParent).values({ childId: child, parentId }),
      ),
    );
  }
  if ("unknownParent" in plan && plan.unknownParent) {
    const parentId = randomId();
    steps.push(
      db
        .insert(schema.relative)
        .values({ id: parentId, name: "?", createdAt: now, changedAt: now }),
      ...plan.unknownParent.map((childId) =>
        db.insert(schema.relativeParent).values({ childId, parentId }),
      ),
    );
  }
  if (steps.length > 0) await db.batch(steps as [(typeof steps)[0], ...typeof steps]);
  return c.json(await allRelatives(db));
});
