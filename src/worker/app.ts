import { Hono } from "hono";
import { getDb, schema } from "./db";
import { authRoutes } from "./routes/auth";
import { recoveryEmailRoutes, recoveryRoutes } from "./routes/recovery";
import { deviceRoutes } from "./routes/device";
import { devicesRoutes } from "./routes/devices";
import { entryRoutes } from "./routes/entries";
import { entryTypeRoutes } from "./routes/entry-types";
import { imageRoutes } from "./routes/images";
import { familyRoutes } from "./routes/family";
import { personRoutes } from "./routes/persons";
import { taskRoutes } from "./routes/tasks";
import { checklistRoutes } from "./routes/checklists";
import { errorRoutes, unexpectedError } from "./routes/errors";
import { feedRoutes, publicFeedRoutes } from "./routes/feeds";
import { weatherRoutes } from "./routes/weather";
import { apiSecureHeaders, sameOriginOnly } from "./security";
import type { AppEnv } from "./types";

export const app = new Hono<AppEnv>().basePath("/api");

app.use(apiSecureHeaders, sameOriginOnly);
app.use(async (c, next) => {
  c.set("db", getDb(c.env.DB));
  c.set("now", new Date());
  await next();
});

// Any unexpected failure is logged with a code the device shows to the Family.
app.onError(unexpectedError);

app.get("/health", async (c) => {
  const families = await c.get("db").select({ id: schema.family.id }).from(schema.family).limit(1);
  return c.json({ status: "ok", familyExists: families.length > 0 });
});

app.route("/", authRoutes);
// Before any route group that requires a signed-in device.
app.route("/", recoveryRoutes);
app.route("/", publicFeedRoutes);
app.route("/", recoveryEmailRoutes);
app.route("/", deviceRoutes);
app.route("/", devicesRoutes);
app.route("/", imageRoutes);
app.route("/", familyRoutes);
app.route("/", personRoutes);
app.route("/", entryTypeRoutes);
app.route("/", entryRoutes);
app.route("/", taskRoutes);
app.route("/", checklistRoutes);
app.route("/", errorRoutes);
app.route("/", feedRoutes);
app.route("/", weatherRoutes);
