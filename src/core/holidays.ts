import type Holidays from "date-holidays";
import type { PlainDate } from "./plain-date";

/** Where the Family's days off come from: a country with an optional region and municipality. */
export type HolidayPlace = { country: string; state?: string; region?: string };

export const DEFAULT_HOLIDAY_PLACES: HolidayPlace[] = [{ country: "PT" }];
export const MAX_HOLIDAY_PLACES = 10;

const CODE = /^[A-Za-z0-9-]{1,10}$/;

export function isHolidayPlaces(value: unknown): value is HolidayPlace[] {
  if (!Array.isArray(value) || value.length > MAX_HOLIDAY_PLACES) return false;
  return value.every((p) => {
    if (typeof p !== "object" || p === null) return false;
    const { country, state, region } = p as Record<string, unknown>;
    if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return false;
    if (state !== undefined && (typeof state !== "string" || !CODE.test(state))) return false;
    if (region !== undefined && (typeof region !== "string" || !CODE.test(region))) return false;
    return region === undefined || state !== undefined;
  });
}

/** `date-holidays` itself, passed in so the browser can load it lazily. */
export type HolidayLibrary = typeof Holidays;

/**
 * Public Holidays in a date window, both ends included, by date: their names in the device's
 * language, without repeats when several places share a day.
 */
export function publicHolidays(
  Library: HolidayLibrary,
  places: HolidayPlace[],
  from: PlainDate,
  to: PlainDate,
  language: string,
): Map<PlainDate, string[]> {
  const lang = language.slice(0, 2);
  const out = new Map<PlainDate, string[]>();
  for (const place of places) {
    const calendar = new Library({
      country: place.country,
      ...(place.state ? { state: place.state } : {}),
      ...(place.region ? { region: place.region } : {}),
    });
    for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
      for (const holiday of calendar.getHolidays(year, lang) || []) {
        const date = holiday.date.slice(0, 10);
        if (holiday.type !== "public" || date < from || date > to) continue;
        const names = out.get(date) ?? [];
        if (!names.includes(holiday.name)) names.push(holiday.name);
        out.set(date, names);
      }
    }
  }
  return out;
}
