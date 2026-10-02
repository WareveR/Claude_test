import type { PlainDate } from "./plain-date";

/** The eight weather icons the app draws. */
export type WeatherKind =
  "sunny" | "partlyCloudy" | "cloudy" | "rain" | "showers" | "thunder" | "snow" | "fog";

/** The icon for a WMO weather code, as Open-Meteo reports it. */
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return "sunny";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 95) return "thunder";
  return "rain"; // drizzle 51–57 and rain 61–67
}

export type DayWeather = { date: PlainDate; code: number; max: number; min: number };
/** One hour, `time` as the location's wall clock `YYYY-MM-DDTHH:MM`; `rain` is a percentage. */
export type HourWeather = { time: string; code: number; temp: number; rain: number };

/** What is kept of an Open-Meteo forecast; `utcOffset` is the place's offset in seconds. */
export type Forecast = { utcOffset: number; daily: DayWeather[]; hourly: HourWeather[] };

/** A saved place to show the weather for. */
export type WeatherPlace = {
  name: string;
  admin: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

export const MAX_WEATHER_LOCATIONS = 10;
/** Days with a forecast shown in the views, today included; from day 8 they are lighter. */
export const FORECAST_DAYS = 15;
export const CERTAIN_DAYS = 7;

const OPEN_METEO_DAYS = 16;

/** Open-Meteo forecast query: 16 days daily, hourly with chance of rain, in the place's clock. */
export function forecastQuery(place: Pick<WeatherPlace, "latitude" | "longitude">): string {
  return new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    hourly: "weather_code,temperature_2m,precipitation_probability",
    timezone: "auto",
    forecast_days: String(OPEN_METEO_DAYS),
  }).toString();
}

type OpenMeteoForecast = {
  utc_offset_seconds?: unknown;
  daily?: Record<string, unknown[]>;
  hourly?: Record<string, unknown[]>;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Keeps the days and hours of an Open-Meteo answer that have every value; throws on garbage. */
export function parseForecast(body: unknown): Forecast {
  const { daily, hourly, utc_offset_seconds } = (body ?? {}) as OpenMeteoForecast;
  if (!Array.isArray(daily?.time) || !Array.isArray(hourly?.time)) {
    throw new Error("Unexpected Open-Meteo forecast");
  }
  const days: DayWeather[] = [];
  daily.time.forEach((date, i) => {
    const code = daily.weather_code?.[i];
    const max = daily.temperature_2m_max?.[i];
    const min = daily.temperature_2m_min?.[i];
    if (typeof date === "string" && isNumber(code) && isNumber(max) && isNumber(min)) {
      days.push({ date, code, max: Math.round(max), min: Math.round(min) });
    }
  });
  const hours: HourWeather[] = [];
  hourly.time.forEach((time, i) => {
    const code = hourly.weather_code?.[i];
    const temp = hourly.temperature_2m?.[i];
    const rain = hourly.precipitation_probability?.[i];
    if (typeof time === "string" && isNumber(code) && isNumber(temp)) {
      hours.push({ time, code, temp: Math.round(temp), rain: isNumber(rain) ? rain : 0 });
    }
  });
  const utcOffset = isNumber(utc_offset_seconds) ? utc_offset_seconds : 0;
  return { utcOffset, daily: days, hourly: hours };
}

/** The place's wall-clock time now, as `YYYY-MM-DDTHH:MM`, like the forecast's hours. */
export function placeClock(utcOffset: number, now: Date): string {
  return new Date(now.getTime() + utcOffset * 1000).toISOString().slice(0, 16);
}

type OpenMeteoPlace = {
  id?: unknown;
  name?: unknown;
  admin1?: unknown;
  country?: unknown;
  country_code?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

/** Search results from Open-Meteo's geocoding API, keeping only complete places. */
export function parsePlaces(body: unknown): WeatherPlace[] {
  const results = (body as { results?: OpenMeteoPlace[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r) =>
    typeof r.name === "string" &&
    typeof r.country_code === "string" &&
    isNumber(r.latitude) &&
    isNumber(r.longitude)
      ? [
          {
            name: r.name,
            admin: typeof r.admin1 === "string" ? r.admin1 : "",
            country: typeof r.country === "string" ? r.country : r.country_code,
            countryCode: r.country_code.toUpperCase(),
            latitude: r.latitude,
            longitude: r.longitude,
          },
        ]
      : [],
  );
}

/** Where tapping the weather goes: IPMA for Portugal, yr.no elsewhere. */
export function forecastSite(place: Pick<WeatherPlace, "countryCode" | "latitude" | "longitude">) {
  if (place.countryCode === "PT") {
    return { name: "IPMA", url: "https://www.ipma.pt/pt/otempo/prev.localidade.hora/" };
  }
  const at = `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`;
  return { name: "yr.no", url: `https://www.yr.no/en/forecast/daily-table/${at}` };
}
