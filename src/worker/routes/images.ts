import { Hono } from "hono";
import { randomToken } from "../auth/crypto";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
/** Images are shrunk to about 256 px in the browser, so anything bigger is a mistake. */
const MAX_BYTES = 512 * 1024;

/** Person photos and Entry Type thumbnails, served only to Signed-in Devices. */
export const imageRoutes = new Hono<AppEnv>().use(requireDevice);

imageRoutes.post("/images", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  if (!TYPES.has(contentType)) return c.json({ error: "invalid", field: "contentType" }, 415);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return c.json({ error: "invalid", field: "size" }, 413);
  }
  const key = randomToken(16);
  const now = c.get("now").toISOString();
  await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType } });
  await c
    .get("db")
    .insert(schema.image)
    .values({ key, contentType, createdAt: now, lastUsedAt: now });
  return c.json({ key }, 201);
});

imageRoutes.get("/images/:key", async (c) => {
  const object = await c.env.IMAGES.get(c.req.param("key"));
  if (!object) return c.json({ error: "not_found" }, 404);
  return c.body(object.body, 200, {
    "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
    // Keys are never reused, so a browser may keep an image for good.
    "Cache-Control": "private, max-age=31536000, immutable",
  });
});
