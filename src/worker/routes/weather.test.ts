import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, schema } from "../db";
import worker from "../index";
import { setUpFamily, TestBrowser } from "../test/client";

const LISBOA = {
  name: "Lisboa",
  admin: "Lisboa",
  country: "Portugal",
  countryCode: "PT",
  latitude: 38.71667,
  longitude: -9.13333,
};
const PORTO = { ...LISBOA, name: "Porto", admin: "Porto", latitude: 41.15, longitude: -8.61 };

/** A forecast from today on, in UTC, with every day's high as `max`. */
function forecastBody(max = 21) {
  const today = new Date().toISOString().slice(0, 10);
  const days = Array.from({ length: 16 }, (_, i) =>
    new Date(Date.parse(today) + i * 86_400_000).toISOString().slice(0, 10),
  );
  const hours = days
    .slice(0, 2)
    .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`));
  return {
    utc_offset_seconds: 0,
    daily: {
      time: days,
      weather_code: days.map(() => 3),
      temperature_2m_max: days.map(() => max),
      temperature_2m_min: days.map(() => 12),
    },
    hourly: {
      time: hours,
      weather_code: hours.map(() => 61),
      temperature_2m: hours.map(() => 15),
      precipitation_probability: hours.map(() => 70),
      relative_humidity_2m: hours.map(() => 80),
      wind_speed_10m: hours.map(() => 14),
      wind_direction_10m: hours.map(() => 300),
    },
    current: {
      time: `${today}T10:00`,
      weather_code: 61,
      temperature_2m: 16.4,
      relative_humidity_2m: 82,
      wind_speed_10m: 15,
      wind_direction_10m: 290,
    },
  };
}

let calls: string[] = [];
let answer: () => Response = () => Response.json(forecastBody());
let searchAnswer: () => Response;
const SEARCH_RESULT = {
  results: [
    {
      id: 2267057,
      name: "Lisboa",
      admin1: "Lisboa",
      country: "Portugal",
      country_code: "PT",
      latitude: 38.71667,
      longitude: -9.13333,
    },
  ],
};

beforeEach(() => {
  calls = [];
  answer = () => Response.json(forecastBody());
  searchAnswer = () => Response.json(SEARCH_RESULT);
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("open-meteo") && !url.includes("localhost:4174")) {
      return realFetch(input, init);
    }
    calls.push(url);
    return url.includes("/v1/search") ? searchAnswer() : answer();
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Locations = { locations: { id: string; name: string }[]; selectedId: string | null };
type Weather = {
  location: { name: string };
  daily: { date: string; max: number }[];
  hourly: { time: string; rain: number; humidity?: number; wind?: number }[];
  current?: { temp: number; humidity?: number; windDir?: number };
} | null;

function runScheduler(at: Date) {
  const controller = { scheduledTime: at.getTime(), cron: "*/5 * * * *" };
  return worker.scheduled(controller as ScheduledController, env);
}

describe("Weather", () => {
  it("finds towns through Open-Meteo's search in the device's language", async () => {
    const browser = await setUpFamily();
    const res = await browser.get("/weather/search?q=Lisb");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([LISBOA]);
    expect(calls[0]).toContain("/v1/search?name=Lisb&count=10&language=pt");
    expect(await (await browser.get("/weather/search?q=L")).json()).toEqual([]);

    searchAnswer = () => new Response("down", { status: 503 });
    expect((await browser.get("/weather/search?q=Lisb")).status).toBe(502);
  });

  it("shows no weather until a place is saved; the first one is selected and fetched", async () => {
    const browser = await setUpFamily();
    expect(await (await browser.get("/weather")).json()).toBeNull();

    const res = await browser.post("/weather/locations", LISBOA);
    expect(res.status).toBe(201);
    const { locations, selectedId } = (await res.json()) as Locations;
    expect(locations).toHaveLength(1);
    expect(selectedId).toBe(locations[0].id);
    expect(calls.some((c) => c.includes("/v1/forecast?latitude=38.71667"))).toBe(true);

    const weather = (await (await browser.get("/weather")).json()) as Weather;
    expect(weather?.location.name).toBe("Lisboa");
    expect(weather?.daily).toHaveLength(16);
    expect(weather?.hourly).toHaveLength(48);
    expect(weather?.hourly[0]).toMatchObject({ rain: 70, humidity: 80, wind: 14 });
    expect(weather?.current).toMatchObject({ temp: 16, humidity: 82, windDir: 290 });
  });

  it("still serves a forecast without the current conditions", async () => {
    const older: Partial<ReturnType<typeof forecastBody>> = forecastBody();
    delete older.current;
    answer = () => Response.json(older);
    const browser = await setUpFamily();
    await browser.post("/weather/locations", LISBOA);
    const weather = (await (await browser.get("/weather")).json()) as Weather;
    expect(weather?.daily).toHaveLength(16);
    expect(weather).not.toHaveProperty("current");
  });

  it("keeps each day's last reading, so past days still show their weather", async () => {
    const browser = await setUpFamily();
    await browser.post("/weather/locations", LISBOA);
    const today = new Date().toISOString().slice(0, 10);
    type Past = { day: { date: string; max: number }; hours: { time: string }[] }[];
    let past = (await (
      await browser.get(`/weather/past?from=${today}&to=${today}`)
    ).json()) as Past;
    expect(past).toHaveLength(1);
    expect(past[0].day.max).toBe(21);
    expect(past[0].hours).toHaveLength(24);

    // A later reading replaces the day's earlier one.
    answer = () => Response.json(forecastBody(25));
    await browser.post("/weather/locations", PORTO);
    const lisboa = ((await (await browser.get("/weather/locations")).json()) as Locations)
      .locations[0];
    await browser.request("PUT", "/weather/selected", { id: lisboa.id });
    past = (await (await browser.get(`/weather/past?from=${today}&to=${today}`)).json()) as Past;
    expect(past[0].day.max).toBe(25);

    expect((await browser.get("/weather/past?from=x&to=y")).status).toBe(400);
  });

  it("keeps up to 10 places, refuses repeats, and the selection is Family-wide", async () => {
    const browser = await setUpFamily();
    await browser.post("/weather/locations", LISBOA);
    expect((await browser.post("/weather/locations", LISBOA)).status).toBe(409);
    expect((await browser.post("/weather/locations", { name: "x" })).status).toBe(400);
    const porto = ((await (await browser.post("/weather/locations", PORTO)).json()) as Locations)
      .locations[1];
    for (let i = 2; i < 10; i++) {
      const res = await browser.post("/weather/locations", { ...LISBOA, latitude: i });
      expect(res.status).toBe(201);
    }
    expect((await browser.post("/weather/locations", { ...LISBOA, latitude: 50 })).status).toBe(
      409,
    );

    answer = () => Response.json(forecastBody(30));
    const selected = await browser.request("PUT", "/weather/selected", { id: porto.id });
    expect(((await selected.json()) as Locations).selectedId).toBe(porto.id);
    const weather = (await (await browser.get("/weather")).json()) as Weather;
    expect(weather?.location.name).toBe("Porto");
    expect(weather?.daily[0].max).toBe(30);
    expect((await browser.request("PUT", "/weather/selected", { id: "nope" })).status).toBe(404);
  });

  it("removing the selected place selects the oldest one left", async () => {
    const browser = await setUpFamily();
    const lisboa = ((await (await browser.post("/weather/locations", LISBOA)).json()) as Locations)
      .locations[0];
    await browser.post("/weather/locations", PORTO);
    const left = (await (
      await browser.delete(`/weather/locations/${lisboa.id}`)
    ).json()) as Locations;
    expect(left.locations.map((l) => l.name)).toEqual(["Porto"]);
    expect(left.selectedId).toBe(left.locations[0].id);
    const none = (await (
      await browser.delete(`/weather/locations/${left.locations[0].id}`)
    ).json()) as Locations;
    expect(none).toEqual({ locations: [], selectedId: null });
    expect(await (await browser.get("/weather")).json()).toBeNull();
  });

  it("refreshes hourly from the Scheduler and shows the last forecast for up to a day", async () => {
    const browser = await setUpFamily();
    await browser.post("/weather/locations", LISBOA);
    const db = getDb(env.DB);

    // Just fetched: the Scheduler waits an hour.
    calls = [];
    await runScheduler(new Date());
    expect(calls).toHaveLength(0);

    // An hour later Open-Meteo fails: the last forecast stays.
    answer = () => new Response("down", { status: 503 });
    await runScheduler(new Date(Date.now() + 60 * 60 * 1000));
    expect(calls).toHaveLength(1);
    expect(await (await browser.get("/weather")).json()).not.toBeNull();
    const [logged] = await db.select().from(schema.errorLog);
    expect(logged.action).toBe("scheduler weather");

    // A day after the last good fetch, the weather disappears.
    await db
      .update(schema.weatherCache)
      .set({ fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() });
    expect(await (await browser.get("/weather")).json()).toBeNull();

    answer = () => Response.json(forecastBody(25));
    await runScheduler(new Date(Date.now() + 2 * 60 * 60 * 1000));
    const weather = (await (await browser.get("/weather")).json()) as Weather;
    expect(weather?.daily[0].max).toBe(25);
  });

  it("needs a signed-in device", async () => {
    await setUpFamily();
    expect((await new TestBrowser("192.0.2.90").get("/weather")).status).toBe(401);
  });
});
