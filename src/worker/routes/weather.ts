import { and, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import {
  forecastQuery,
  MAX_WEATHER_LOCATIONS,
  parseForecast,
  parsePlaces,
  placeClock,
  type WeatherPlace,
} from "../../core/weather";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const HOUR = 60 * 60 * 1000;
/** A forecast older than this is no longer shown: stale weather must not mislead. */
const SHOWN_FOR = 24 * HOUR;
/** The Scheduler runs every 5 minutes; this keeps fetching to once an hour. */
const REFRESH_EVERY = 55 * 60 * 1000;
const TIMEOUT = 10_000;

type WeatherEnv = Pick<Env, "OPEN_METEO_FORECAST_URL" | "OPEN_METEO_GEOCODING_URL">;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  return res.json();
}

async function selectedLocation(db: Db) {
  const [family] = await db
    .select({ id: schema.family.selectedWeatherLocationId })
    .from(schema.family)
    .limit(1);
  if (!family?.id) return null;
  const [location] = await db
    .select()
    .from(schema.weatherLocation)
    .where(eq(schema.weatherLocation.id, family.id));
  return location ?? null;
}

/** Fetches and keeps a Weather Location's forecast; throws when Open-Meteo fails. */
export async function refreshForecast(db: Db, env: WeatherEnv, locationId: string, now: Date) {
  const [location] = await db
    .select()
    .from(schema.weatherLocation)
    .where(eq(schema.weatherLocation.id, locationId));
  if (!location) return;
  const at = now.toISOString();
  try {
    const forecast = parseForecast(
      await getJson(`${env.OPEN_METEO_FORECAST_URL}/v1/forecast?${forecastQuery(location)}`),
    );
    await db
      .insert(schema.weatherCache)
      .values({ locationId, forecast, fetchedAt: at, attemptedAt: at })
      .onConflictDoUpdate({
        target: schema.weatherCache.locationId,
        set: { forecast, fetchedAt: at, attemptedAt: at },
      });
  } catch (error) {
    // The last forecast stays; it is shown until it is a day old.
    await db
      .insert(schema.weatherCache)
      .values({ locationId, attemptedAt: at })
      .onConflictDoUpdate({ target: schema.weatherCache.locationId, set: { attemptedAt: at } });
    throw error;
  }
}

/** Scheduler: the selected Weather Location's forecast, at most once an hour. */
export async function weatherJob(db: Db, env: Env, now: Date) {
  const location = await selectedLocation(db);
  if (!location) return;
  const at = now.toISOString();
  // Claiming the hour first means two overlapping runs don't both fetch.
  const inserted = await db
    .insert(schema.weatherCache)
    .values({ locationId: location.id, attemptedAt: at })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    const claimed = await db
      .update(schema.weatherCache)
      .set({ attemptedAt: at })
      .where(
        and(
          eq(schema.weatherCache.locationId, location.id),
          lt(
            schema.weatherCache.attemptedAt,
            new Date(now.getTime() - REFRESH_EVERY).toISOString(),
          ),
        ),
      )
      .returning();
    if (claimed.length === 0) return;
  }
  await refreshForecast(db, env, location.id, now);
}

/** A fetch right after the selection changes; on failure the Scheduler tries again. */
async function refreshNow(db: Db, env: WeatherEnv, locationId: string, now: Date) {
  await refreshForecast(db, env, locationId, now).catch((error: unknown) =>
    console.warn("weather", error),
  );
}

async function listLocations(db: Db) {
  const [locations, [family]] = await Promise.all([
    db
      .select({
        id: schema.weatherLocation.id,
        name: schema.weatherLocation.name,
        admin: schema.weatherLocation.admin,
        country: schema.weatherLocation.country,
        countryCode: schema.weatherLocation.countryCode,
        latitude: schema.weatherLocation.latitude,
        longitude: schema.weatherLocation.longitude,
      })
      .from(schema.weatherLocation)
      .orderBy(schema.weatherLocation.createdAt),
    db.select({ id: schema.family.selectedWeatherLocationId }).from(schema.family).limit(1),
  ]);
  return {
    locations,
    selectedId: family?.id ?? null,
  };
}

function parsePlace(body: Record<string, unknown>): WeatherPlace | null {
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const number = (value: unknown, limit: number) =>
    typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
  const place = {
    name: text(body.name, 100),
    admin: text(body.admin, 100),
    country: text(body.country, 100),
    countryCode: text(body.countryCode, 2).toUpperCase(),
    latitude: number(body.latitude, 90),
    longitude: number(body.longitude, 180),
  };
  if (!place.name || !/^[A-Z]{2}$/.test(place.countryCode)) return null;
  if (place.latitude === null || place.longitude === null) return null;
  return { ...place, latitude: place.latitude, longitude: place.longitude };
}

/** Settings › Weather and the forecast every view shows. */
export const weatherRoutes = new Hono<AppEnv>().use(requireDevice);

/** Town search, through Open-Meteo's geocoding. */
weatherRoutes.get("/weather/search", async (c) => {
  const name = (c.req.query("q") ?? "").trim().slice(0, 100);
  if (name.length < 2) return c.json([]);
  const language = (c.get("device").language ?? "pt-PT").slice(0, 2);
  const query = new URLSearchParams({ name, count: "10", language, format: "json" });
  try {
    return c.json(
      parsePlaces(await getJson(`${c.env.OPEN_METEO_GEOCODING_URL}/v1/search?${query}`)),
    );
  } catch (error) {
    console.warn("weather search", error);
    return c.json({ error: "weather_unavailable" }, 502);
  }
});

weatherRoutes.get("/weather/locations", async (c) => c.json(await listLocations(c.get("db"))));

/** Saves a place; the first one saved is selected, so the weather shows at once. */
weatherRoutes.post("/weather/locations", async (c) => {
  const db = c.get("db");
  const place = parsePlace(await c.req.json().catch(() => ({})));
  if (!place) return c.json({ error: "invalid" }, 400);
  const existing = await db.select().from(schema.weatherLocation);
  if (existing.length >= MAX_WEATHER_LOCATIONS) return c.json({ error: "too_many" }, 409);
  const same = existing.find(
    (l) => l.latitude === place.latitude && l.longitude === place.longitude,
  );
  if (same) return c.json({ error: "duplicate" }, 409);
  const id = randomId();
  const now = c.get("now");
  await db.insert(schema.weatherLocation).values({ id, ...place, createdAt: now.toISOString() });
  if (existing.length === 0) {
    await db.update(schema.family).set({ selectedWeatherLocationId: id });
    await refreshNow(db, c.env, id, now);
  }
  return c.json(await listLocations(db), 201);
});

/** Selects the Family's Weather Location, for every device, and fetches its forecast. */
weatherRoutes.put("/weather/selected", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const [location] = await db
    .select({ id: schema.weatherLocation.id })
    .from(schema.weatherLocation)
    .where(eq(schema.weatherLocation.id, id));
  if (!location) return c.json({ error: "not_found" }, 404);
  await db.update(schema.family).set({ selectedWeatherLocationId: id });
  await refreshNow(db, c.env, id, c.get("now"));
  return c.json(await listLocations(db));
});

/** Removes a place; removing the selected one selects the oldest left, if any. */
weatherRoutes.delete("/weather/locations/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const deleted = await db
    .delete(schema.weatherLocation)
    .where(eq(schema.weatherLocation.id, id))
    .returning({ id: schema.weatherLocation.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  const { locations, selectedId } = await listLocations(db);
  if (selectedId === id) {
    const next = locations[0]?.id ?? null;
    await db.update(schema.family).set({ selectedWeatherLocationId: next });
    if (next) await refreshNow(db, c.env, next, c.get("now"));
  }
  return c.json(await listLocations(db));
});

/**
 * The selected Weather Location's forecast from the cache: every day, and the hours of the
 * place's today and tomorrow. Null when there is none, or it is more than a day old.
 */
weatherRoutes.get("/weather", async (c) => {
  const db = c.get("db");
  const location = await selectedLocation(db);
  if (!location) return c.json(null);
  const now = c.get("now");
  const [cache] = await db
    .select()
    .from(schema.weatherCache)
    .where(eq(schema.weatherCache.locationId, location.id));
  if (!cache?.forecast || !cache.fetchedAt) return c.json(null);
  if (now.getTime() - Date.parse(cache.fetchedAt) > SHOWN_FOR) return c.json(null);
  const { utcOffset, daily, hourly } = cache.forecast;
  const today = placeClock(utcOffset, now).slice(0, 10);
  const tomorrow = placeClock(utcOffset, new Date(now.getTime() + 24 * HOUR)).slice(0, 10);
  return c.json({
    location: {
      id: location.id,
      name: location.name,
      countryCode: location.countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    fetchedAt: cache.fetchedAt,
    utcOffset,
    daily: daily.filter((d) => d.date >= today),
    hourly: hourly.filter((h) => h.time.startsWith(today) || h.time.startsWith(tomorrow)),
  });
});
