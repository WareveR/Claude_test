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

/** 16 days from today in Lisbon: sunny, then partly cloudy, cloudy, rain, …; highs 20, 21, … */
function forecast() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
  const days = Array.from({ length: 16 }, (_, i) =>
    new Date(Date.parse(today) + i * 86_400_000).toISOString().slice(0, 10),
  );
  const codes = [0, 2, 3, 61, 80, 95, 71, 45];
  const hours = days.flatMap((d) =>
    Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`),
  );
  return {
    utc_offset_seconds: 3600,
    daily: {
      time: days,
      weather_code: days.map((_, i) => codes[i % codes.length]),
      temperature_2m_max: days.map((_, i) => 20 + i),
      temperature_2m_min: days.map((_, i) => 10 + i),
    },
    hourly: {
      time: hours,
      weather_code: hours.map((_, i) => (i % 24 < 12 ? 0 : 61)),
      temperature_2m: hours.map((_, i) => 12 + (i % 24) / 2),
      precipitation_probability: hours.map((_, i) => (i % 24 < 12 ? 0 : 80)),
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
