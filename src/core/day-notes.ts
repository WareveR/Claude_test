import type * as Astronomy from "astronomy-engine";
import { addDays, todayIn, type PlainDate } from "./plain-date";

/**
 * Calendar Layers: optional things shown on the days, calculated here and never stored.
 * Each device picks which ones it shows.
 */
export const LAYERS = [
  "school",
  "special",
  "moon",
  "seasons",
  "clock",
  "sky",
  "sun",
  "waste",
] as const;
export type Layer = (typeof LAYERS)[number];

/** One thing a Layer says about a day: a translation key and, for timed events, a local time. */
export type DayNote = { layer: Layer; key: string; time?: string };

export type Place = { latitude: number; longitude: number };

type Astro = typeof Astronomy;

const MOON = ["moon.new", "moon.firstQuarter", "moon.full", "moon.lastQuarter"];

/** The days around a window, as instants: from the day before `from` to the day after `to`. */
function bounds(from: PlainDate, to: PlainDate) {
  return {
    start: new Date(`${addDays(from, -1)}T00:00:00Z`),
    end: new Date(`${addDays(to, 2)}T00:00:00Z`),
  };
}

function clock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Minutes ahead of UTC at an instant in a time zone. */
function offsetMinutes(date: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** Easter Sunday (Gregorian), by the anonymous algorithm. */
export function easter(year: number): PlainDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Portugal's family days that are not Public Holidays. */
export function specialDays(year: number): [PlainDate, string][] {
  const may1 = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  const mothersDay = `${year}-05-${String(1 + ((7 - may1) % 7)).padStart(2, "0")}`;
  const sunday = easter(year);
  return [
    [`${year}-02-14`, "special.valentines"],
    [addDays(sunday, -47), "special.carnival"],
    [`${year}-03-19`, "special.fathersDay"],
    [sunday, "special.easter"],
    [mothersDay, "special.mothersDay"],
    [`${year}-06-01`, "special.childrensDay"],
    [`${year}-07-26`, "special.grandparentsDay"],
    [`${year}-10-31`, "special.halloween"],
  ];
}

/**
 * Portugal's school calendar (public schools, mainland), from the Government's yearly order
 * (Despacho n.º 8368/2024 for 2025/26 and 2026/27). Add the next years as they are published.
 */
const SCHOOL_DAYS: [PlainDate, string][] = [
  ["2025-12-17", "school.christmasBreak"],
  ["2026-01-05", "school.back"],
  ["2026-02-16", "school.carnivalBreak"],
  ["2026-02-19", "school.back"],
  ["2026-03-30", "school.easterBreak"],
  ["2026-04-13", "school.back"],
  ["2026-06-05", "school.endSecondary"],
  ["2026-06-12", "school.endMiddle"],
  ["2026-06-30", "school.endPrimary"],
  ["2026-09-11", "school.start"],
  ["2026-12-16", "school.christmasBreak"],
  ["2027-01-04", "school.back"],
  ["2027-02-08", "school.carnivalBreak"],
  ["2027-02-11", "school.back"],
  ["2027-03-22", "school.easterBreak"],
  ["2027-04-05", "school.back"],
  ["2027-06-04", "school.endSecondary"],
  ["2027-06-11", "school.endMiddle"],
  ["2027-06-30", "school.endPrimary"],
];

/** Peak nights of the major meteor showers; they barely move from year to year. */
const METEOR_SHOWERS: [string, string][] = [
  ["01-03", "sky.quadrantids"],
  ["04-22", "sky.lyrids"],
  ["05-06", "sky.etaAquariids"],
  ["08-12", "sky.perseids"],
  ["10-21", "sky.orionids"],
  ["11-17", "sky.leonids"],
  ["12-14", "sky.geminids"],
];

/** What the chosen Layers say about each day of a window, in the Family Time Zone. */
export function dayNotes(
  A: Astro,
  {
    from,
    to,
    timeZone,
    layers,
    place,
  }: {
    from: PlainDate;
    to: PlainDate;
    timeZone: string;
    layers: readonly Layer[];
    /** The selected Weather Location; eclipses are only shown when they can be seen there. */
    place: Place | null;
  },
): Map<PlainDate, DayNote[]> {
  const notes = new Map<PlainDate, DayNote[]>();
  const add = (date: PlainDate, note: DayNote) => {
    if (date < from || date > to) return;
    notes.set(date, [...(notes.get(date) ?? []), note]);
  };
  const on = (layer: Layer) => layers.includes(layer);
  const { start, end } = bounds(from, to);
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));

  if (on("moon")) {
    for (let q = A.SearchMoonQuarter(start); q.time.date < end; q = A.NextMoonQuarter(q)) {
      add(todayIn(timeZone, q.time.date), {
        layer: "moon",
        key: MOON[q.quarter],
        time: clock(q.time.date, timeZone),
      });
    }
  }

  if (on("seasons")) {
    for (let year = firstYear; year <= lastYear; year++) {
      const s = A.Seasons(year);
      const starts: [Astronomy.AstroTime, string][] = [
        [s.mar_equinox, "season.spring"],
        [s.jun_solstice, "season.summer"],
        [s.sep_equinox, "season.autumn"],
        [s.dec_solstice, "season.winter"],
      ];
      for (const [time, key] of starts) {
        add(todayIn(timeZone, time.date), {
          layer: "seasons",
          key,
          time: clock(time.date, timeZone),
        });
      }
    }
  }

  if (on("clock")) {
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const before = offsetMinutes(new Date(`${day}T00:00:00Z`), timeZone);
      const after = offsetMinutes(new Date(`${addDays(day, 1)}T00:00:00Z`), timeZone);
      if (after > before) add(day, { layer: "clock", key: "clock.forward" });
      if (after < before) add(day, { layer: "clock", key: "clock.back" });
    }
  }

  if (on("school")) {
    for (const [date, key] of SCHOOL_DAYS) add(date, { layer: "school", key });
  }

  if (on("special")) {
    for (let year = firstYear; year <= lastYear; year++) {
      for (const [date, key] of specialDays(year)) add(date, { layer: "special", key });
    }
  }

  if (on("sky")) {
    for (let year = firstYear; year <= lastYear; year++) {
      for (const [monthDay, key] of METEOR_SHOWERS)
        add(`${year}-${monthDay}`, { layer: "sky", key });
    }
    for (let e = A.SearchLunarEclipse(start); e.peak.date < end; e = A.NextLunarEclipse(e.peak)) {
      if (e.kind === A.EclipseKind.Penumbral) continue;
      if (place) {
        const observer = new A.Observer(place.latitude, place.longitude, 0);
        const moon = A.Equator(A.Body.Moon, e.peak, observer, true, true);
        if (A.Horizon(e.peak, observer, moon.ra, moon.dec, "normal").altitude <= 0) continue;
      }
      add(todayIn(timeZone, e.peak.date), {
        layer: "sky",
        key: `sky.lunarEclipse.${e.kind}`,
        time: clock(e.peak.date, timeZone),
      });
    }
    if (place) {
      const observer = new A.Observer(place.latitude, place.longitude, 0);
      for (
        let e = A.SearchLocalSolarEclipse(start, observer);
        e.peak.time.date < end;
        e = A.NextLocalSolarEclipse(e.peak.time, observer)
      ) {
        // Seen only if the Sun is up for some part of it.
        const up = [e.partial_begin, e.peak, e.partial_end].some((ev) => ev.altitude > 0);
        if (!up) continue;
        add(todayIn(timeZone, e.peak.time.date), {
          layer: "sky",
          key: `sky.solarEclipse.${e.kind}`,
          time: clock(e.peak.time.date, timeZone),
        });
      }
    }
  }

  return notes;
}

/** Sunrise and sunset at a place on a day, in the Family Time Zone's clock. */
export function sunTimes(
  A: Astro,
  day: PlainDate,
  timeZone: string,
  place: Place,
): { rise: string | null; set: string | null } {
  const observer = new A.Observer(place.latitude, place.longitude, 0);
  // Search from the start of the day in the Family Time Zone.
  const midnightUtc = new Date(`${day}T00:00:00Z`);
  const start = new Date(midnightUtc.getTime() - offsetMinutes(midnightUtc, timeZone) * 60_000);
  const find = (direction: number) => {
    const time = A.SearchRiseSet(A.Body.Sun, observer, direction, start, 1);
    return time && todayIn(timeZone, time.date) === day ? clock(time.date, timeZone) : null;
  };
  return { rise: find(+1), set: find(-1) };
}

/** The Moon's eight phases, from new moon on, each centred on its angle from the Sun. */
export const MOON_PHASES = [
  "new",
  "waxingCrescent",
  "firstQuarter",
  "waxingGibbous",
  "full",
  "waningGibbous",
  "lastQuarter",
  "waningCrescent",
] as const;
export type MoonPhase = (typeof MOON_PHASES)[number];

/**
 * The Moon at an instant: its phase, the lit percentage of its disc, and its next `count`
 * principal phases (keys as the Moon Layer's notes) with their date and time in `timeZone`.
 */
export function moonNow(
  A: Astro,
  at: Date,
  timeZone: string,
  count = 2,
): { phase: MoonPhase; lit: number; next: (DayNote & { date: PlainDate })[] } {
  const angle = A.MoonPhase(at);
  const phase = MOON_PHASES[Math.round(angle / 45) % 8];
  const lit = Math.round(A.Illumination(A.Body.Moon, at).phase_fraction * 100);
  const next: (DayNote & { date: PlainDate })[] = [];
  for (let q = A.SearchMoonQuarter(at); next.length < count; q = A.NextMoonQuarter(q)) {
    next.push({
      layer: "moon",
      key: MOON[q.quarter],
      date: todayIn(timeZone, q.time.date),
      time: clock(q.time.date, timeZone),
    });
  }
  return { phase, lit, next };
}
