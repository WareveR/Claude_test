// A stand-in for Open-Meteo during the e2e tests: the Worker's weather URLs point here.
import { createServer } from "node:http";
import { URL } from "node:url";

const PLACES = [
  {
    id: 2267057,
    name: "Lisboa",
    admin1: "Lisboa",
    country: "Portugal",
    country_code: "PT",
    latitude: 38.71667,
    longitude: -9.13333,
  },
  {
    id: 3117735,
    name: "Madrid",
    admin1: "Madrid",
    country: "Spain",
    country_code: "ES",
    latitude: 40.4165,
    longitude: -3.70256,
  },
];

/**
 * 16 days from today in Lisbon: sunny, then partly cloudy, cloudy, rain, …; highs 20, 21, …
 * Like Open-Meteo with `past_days`, it also starts with yesterday: rainy, 15°/8°, 90%.
 * Now it is 17° (feels 16°), 72% humidity, wind 18 km/h from the north-west; every hour has
 * 70% humidity and 12 km/h wind from the west, every day 25 km/h from the north and UV 4.
 */
function forecast() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
  const days = Array.from({ length: 16 }, (_, i) =>
    new Date(Date.parse(today) + i * 86_400_000).toISOString().slice(0, 10),
  );
  const codes = [0, 2, 3, 61, 80, 95, 71, 45];
  const hours = days.flatMap((d) =>
    Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`),
  );
  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  const pastHours = Array.from(
    { length: 24 },
    (_, h) => `${yesterday}T${String(h).padStart(2, "0")}:00`,
  );
  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const all = [...pastHours, ...hours];
  return {
    utc_offset_seconds: 3600,
    current: {
      time: `${today}T${now.padStart(2, "0")}:00`,
      weather_code: 2,
      temperature_2m: 17.2,
      apparent_temperature: 16.1,
      relative_humidity_2m: 72,
      wind_speed_10m: 18.3,
      wind_direction_10m: 315,
    },
    daily: {
      time: [yesterday, ...days],
      weather_code: [61, ...days.map((_, i) => codes[i % codes.length])],
      temperature_2m_max: [15, ...days.map((_, i) => 20 + i)],
      temperature_2m_min: [8, ...days.map((_, i) => 10 + i)],
      precipitation_probability_max: [90, ...days.map((_, i) => (i * 10) % 100)],
      wind_speed_10m_max: [30, ...days.map(() => 25)],
      wind_direction_10m_dominant: [200, ...days.map(() => 0)],
      uv_index_max: [2, ...days.map(() => 4)],
    },
    hourly: {
      time: [...pastHours, ...hours],
      weather_code: [...pastHours.map(() => 61), ...hours.map((_, i) => (i % 24 < 12 ? 0 : 61))],
      temperature_2m: [...pastHours.map(() => 9), ...hours.map((_, i) => 12 + (i % 24) / 2)],
      precipitation_probability: [
        ...pastHours.map(() => 90),
        ...hours.map((_, i) => (i % 24 < 12 ? 0 : 80)),
      ],
      relative_humidity_2m: all.map(() => 70),
      wind_speed_10m: all.map(() => 12),
      wind_direction_10m: all.map(() => 270),
    },
  };
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let body;
  if (url.pathname === "/v1/search") {
    const name = (url.searchParams.get("name") ?? "").toLowerCase();
    body = { results: PLACES.filter((p) => p.name.toLowerCase().startsWith(name)) };
  } else if (url.pathname === "/v1/forecast") {
    body = forecast();
  } else if (url.pathname === "/health") {
    body = { ok: true };
  } else {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}).listen(4174);
