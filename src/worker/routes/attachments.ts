import { asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { Account } from "../auth/account";
import { randomId, randomToken } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { mayChangeEntry } from "./entries";
import { mayChangeTask } from "./tasks";

/** Photos are shrunk in the browser; this is for PDFs and other documents. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_PREFIX = "attachments/";
/** Shown in the browser itself; anything else is only ever saved, never opened by the app's origin. */
const INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type Owner =
  | { column: "entryId"; id: string }
  | { column: "taskId"; id: string }
  | { column: "checklistId"; id: string };

const OWNER_PARAMS = { entry: "entryId", task: "taskId", checklist: "checklistId" } as const;

function ownerFrom(query: Record<string, string>): Owner | null {
  const found = Object.entries(OWNER_PARAMS).filter(([param]) => query[param]);
  if (found.length !== 1) return null;
  const [param, column] = found[0];
  return { column, id: query[param] } as Owner;
}

function ownerOf(row: typeof schema.attachment.$inferSelect): Owner {
  if (row.entryId) return { column: "entryId", id: row.entryId };
  if (row.taskId) return { column: "taskId", id: row.taskId };
  return { column: "checklistId", id: row.checklistId! };
}

/**
 * Whether the Account may see and change the attachments of this Entry, Task or Task with items:
 * as with the thing itself, not when it is Private and hidden from it.
 */
async function access(
  db: Db,
  viewer: Account,
  owner: Owner,
): Promise<"ok" | "not_found" | "private"> {
  if (owner.column === "entryId") {
    const [row] = await db.select().from(schema.entry).where(eq(schema.entry.id, owner.id));
    if (!row) return "not_found";
    return (await mayChangeEntry(db, viewer, row)) ? "ok" : "private";
  }
  if (owner.column === "taskId") {
    const [row] = await db.select().from(schema.task).where(eq(schema.task.id, owner.id));
    if (!row) return "not_found";
    return (await mayChangeTask(db, viewer, row)) ? "ok" : "private";
  }
  const [row] = await db
    .select({ id: schema.checklist.id })
    .from(schema.checklist)
    .where(eq(schema.checklist.id, owner.id));
  return row ? "ok" : "not_found";
}

function ownedBy(owner: Owner): SQL {
  return eq(schema.attachment[owner.column], owner.id);
}

/** A picked file's name, kept short and free of paths and control characters. */
export function cleanFileName(raw: string | undefined): string {
  let name: string;
  try {
    name = decodeURIComponent(raw ?? "");
  } catch {
    name = "";
  }
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim();
  return name.slice(-120) || "ficheiro";
}

function cleanType(raw: string | undefined): string {
  const type = (raw ?? "").split(";")[0].trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(type) ? type : "application/octet-stream";
}

/** RFC 6266: an ASCII fallback plus the real name. */
function disposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const present = (row: typeof schema.attachment.$inferSelect) => ({
  id: row.id,
  name: row.name,
  contentType: row.contentType,
  size: row.size,
  createdAt: row.createdAt,
});

/** Photos and files attached to Entries and Tasks, served only to Signed-in Devices. */
export const attachmentRoutes = new Hono<AppEnv>().use(requireDevice);

/** The attachments of one Entry, Task or Task with items (`?entry=`, `?task=`, `?checklist=`). */
attachmentRoutes.get("/attachments", async (c) => {
  const db = c.get("db");
  const owner = ownerFrom(c.req.query());
  if (!owner) return c.json({ error: "invalid", field: "owner" }, 400);
  const allowed = await access(db, c.get("account"), owner);
  if (allowed === "not_found") return c.json({ error: "not_found" }, 404);
  if (allowed === "private") return c.json({ error: "private" }, 403);
  const rows = await db
    .select()
    .from(schema.attachment)
    .where(ownedBy(owner))
    .orderBy(asc(schema.attachment.createdAt));
  return c.json(rows.map(present));
});

/** Adds one file, sent as the raw body with its type and its URI-encoded name in X-File-Name. */
attachmentRoutes.post("/attachments", async (c) => {
  const db = c.get("db");
  const owner = ownerFrom(c.req.query());
  if (!owner) return c.json({ error: "invalid", field: "owner" }, 400);
  const allowed = await access(db, c.get("account"), owner);
  if (allowed === "not_found") return c.json({ error: "not_found" }, 404);
  if (allowed === "private") return c.json({ error: "private" }, 403);
  const length = Number(c.req.header("Content-Length") ?? 0);
  if (length > MAX_ATTACHMENT_BYTES) return c.json({ error: "invalid", field: "size" }, 413);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: "invalid", field: "size" }, 413);
  }
  const contentType = cleanType(c.req.header("Content-Type"));
  const key = ATTACHMENT_PREFIX + randomToken(16);
  await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType } });
  const [row] = await db
    .insert(schema.attachment)
    .values({
      id: randomId(),
      [owner.column]: owner.id,
      key,
      name: cleanFileName(c.req.header("X-File-Name")),
      contentType,
      size: bytes.byteLength,
      createdBy: c.get("account").id,
      createdAt: c.get("now").toISOString(),
    })
    .returning();
  return c.json(present(row), 201);
});

async function loadAllowed(
  db: Db,
  viewer: Account,
  id: string,
): Promise<
  { status: "ok"; row: typeof schema.attachment.$inferSelect } | { status: "not_found" | "private" }
> {
  const [row] = await db.select().from(schema.attachment).where(eq(schema.attachment.id, id));
  if (!row) return { status: "not_found" };
  const allowed = await access(db, viewer, ownerOf(row));
  return allowed === "ok" ? { status: "ok", row } : { status: allowed };
}

/** The file itself: photos and PDFs open in the browser, anything else is downloaded. */
attachmentRoutes.get("/attachments/:id", async (c) => {
  const found = await loadAllowed(c.get("db"), c.get("account"), c.req.param("id"));
  if (found.status !== "ok") {
    return c.json({ error: found.status }, found.status === "not_found" ? 404 : 403);
  }
  const { row } = found;
  const object = await c.env.IMAGES.get(row.key, { onlyIf: c.req.raw.headers });
  if (!object) return c.json({ error: "not_found" }, 404);
  // Asked again each time, so a Private switch turned on later takes effect at once.
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-cache",
    ETag: object.httpEtag,
  };
  if (!("body" in object)) return c.body(null, 304, headers);
  const inline = INLINE_TYPES.has(row.contentType) && c.req.query("download") === undefined;
  return c.body(object.body, 200, {
    ...headers,
    "Content-Type": inline ? row.contentType : "application/octet-stream",
    "Content-Disposition": disposition(inline ? "inline" : "attachment", row.name),
  });
});

attachmentRoutes.delete("/attachments/:id", async (c) => {
  const db = c.get("db");
  const found = await loadAllowed(db, c.get("account"), c.req.param("id"));
  if (found.status !== "ok") {
    return c.json({ error: found.status }, found.status === "not_found" ? 404 : 403);
  }
  // The bytes go with the nightly sweep.
  await db.delete(schema.attachment).where(eq(schema.attachment.id, found.row.id));
  return c.body(null, 204);
});

/** Moves an Entry's or Task's attachments to what it was turned into; part of that batch. */
export function moveAttachments(db: Db, from: Owner, to: Owner) {
  return db
    .update(schema.attachment)
    .set({ entryId: null, taskId: null, checklistId: null, [to.column]: to.id })
    .where(ownedBy(from));
}

/**
 * Part of the nightly image cleanup: deletes the bucket's attachment files whose row is gone
 * (removed, or its Entry or Task deleted) and that are over a day old, so an upload still being
 * saved is never caught.
 */
export async function sweepAttachments(db: Db, env: Env, now: Date) {
  const keys = new Set(
    (await db.select({ key: schema.attachment.key }).from(schema.attachment)).map((r) => r.key),
  );
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  let cursor: string | undefined;
  do {
    const page = await env.IMAGES.list({ prefix: ATTACHMENT_PREFIX, cursor });
    const stale = page.objects
      .filter((o) => !keys.has(o.key) && o.uploaded.getTime() < cutoff)
      .map((o) => o.key);
    if (stale.length > 0) await env.IMAGES.delete(stale);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
