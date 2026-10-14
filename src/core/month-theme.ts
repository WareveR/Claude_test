import { isPlainDate, type PlainDate } from "./plain-date";

/** The colours one month of the Month theme puts over the light theme. */
export type MonthPalette = {
  bg: string;
  line: string;
  accent: string;
  header: string;
  weekend: string;
  weekendInk: string;
};

/**
 * A small drawing for the month on a 24-unit square, drawn in one colour: shapes are filled unless
 * they say `fill="none"`, and lines use the same colour.
 */
type Motif = string;

type MonthLook = { palette: MonthPalette; motif: Motif };

const SNOWFLAKE = `<path fill="none" stroke-width="1.6" stroke-linecap="round" d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>`;
const HEART = `<path d="M12 20.5s-7.5-4.6-9.2-9.2C1.6 7.8 4 4.5 7.2 4.5c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.2 0 5.6 3.3 4.4 6.8-1.7 4.6-9.2 9.2-9.2 9.2z"/>`;
const BLOSSOM = `<circle cx="12" cy="6.5" r="3.4"/><circle cx="17.2" cy="10.3" r="3.4"/><circle cx="15.2" cy="16.5" r="3.4"/><circle cx="8.8" cy="16.5" r="3.4"/><circle cx="6.8" cy="10.3" r="3.4"/>`;
const RAINDROP = `<path d="M12 2.5C9.5 7 6.5 10.5 6.5 14.5a5.5 5.5 0 0 0 11 0c0-4-3-7.5-5.5-12z"/>`;
const DAISY = `<g fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M5.6 18.4l3.5-3.5M14.9 9.1l3.5-3.5"/></g><circle cx="12" cy="12" r="2.6"/>`;
const SARDINE = `<path d="M2 12c3.2-4 8.4-5.6 13.6-3.6L21 5v14l-5.4-3.4C10.4 17.6 5.2 16 2 12z"/>`;
const SUN = `<circle cx="12" cy="12" r="4.5"/><path fill="none" stroke-width="1.8" stroke-linecap="round" d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>`;
const WAVE = `<path fill="none" stroke-width="1.8" stroke-linecap="round" d="M1.5 10c2.6-3 5.2-3 7.8 0s5.2 3 7.8 0 4.2-2.4 5.4-1M1.5 16c2.6-3 5.2-3 7.8 0s5.2 3 7.8 0 4.2-2.4 5.4-1"/>`;
const GRAPES = `<circle cx="8" cy="8" r="2.8"/><circle cx="13.6" cy="8" r="2.8"/><circle cx="10.8" cy="12.6" r="2.8"/><circle cx="16.4" cy="12.6" r="2.8"/><circle cx="13.6" cy="17.2" r="2.8"/><path fill="none" stroke-width="1.5" stroke-linecap="round" d="M11 5.2c.4-1.6 1.4-2.8 3-3.4"/>`;
const LEAF = `<path d="M4.5 19.5C4.5 10 10.5 4 20 4c0 9.5-6 15.5-15.5 15.5z"/><path fill="none" stroke-width="1.4" stroke-linecap="round" d="M3 21l9-9"/>`;
const CHESTNUT = `<path d="M12 3.5c4.6 0 8.5 4.4 8.5 9.6 0 1.8-.6 3-1.6 3.9H5.1c-1-.9-1.6-2.1-1.6-3.9C3.5 7.9 7.4 3.5 12 3.5z"/><path d="M5 18.4h14c-.9 1.6-3.6 2.6-7 2.6s-6.1-1-7-2.6z"/>`;
const STAR = `<path d="M12 2.5l2.8 6 6.6.7-4.9 4.4 1.4 6.5L12 16.8l-5.9 3.3 1.4-6.5-4.9-4.4 6.6-.7z"/>`;

/** One look per month, January first: colours of the season and a small drawing of it. */
const MONTHS: MonthLook[] = [
  {
    palette: {
      bg: "#eef3f8",
      line: "#d3dee9",
      accent: "#2b6cb0",
      header: "#2f5d8a",
      weekend: "#dde8f5",
      weekendInk: "#24507d",
    },
    motif: SNOWFLAKE,
  },
  {
    palette: {
      bg: "#fbf0f3",
      line: "#efd5dd",
      accent: "#c2255c",
      header: "#a3365a",
      weekend: "#fbe1ea",
      weekendInk: "#8f1f47",
    },
    motif: HEART,
  },
  {
    palette: {
      bg: "#f6f6ee",
      line: "#e1e3cf",
      accent: "#b83a6e",
      header: "#4f7a3a",
      weekend: "#fbe6ef",
      weekendInk: "#93305c",
    },
    motif: BLOSSOM,
  },
  {
    palette: {
      bg: "#eff6f5",
      line: "#d2e4e1",
      accent: "#287260",
      header: "#3d7f8c",
      weekend: "#def0ee",
      weekendInk: "#1f6d64",
    },
    motif: RAINDROP,
  },
  {
    palette: {
      bg: "#f5f8ec",
      line: "#dfe7cc",
      accent: "#4d7514",
      header: "#557f27",
      weekend: "#fff1c7",
      weekendInk: "#7d5800",
    },
    motif: DAISY,
  },
  {
    palette: {
      bg: "#fff4ec",
      line: "#f4dccb",
      accent: "#c2410c",
      header: "#b93d0c",
      weekend: "#ffe8cc",
      weekendInk: "#9a3a06",
    },
    motif: SARDINE,
  },
  {
    palette: {
      bg: "#fffaeb",
      line: "#f3e6c1",
      accent: "#b45309",
      header: "#a8650f",
      weekend: "#fff0c2",
      weekendInk: "#8a5a00",
    },
    motif: SUN,
  },
  {
    palette: {
      bg: "#eefafb",
      line: "#cfe9ec",
      accent: "#0a7284",
      header: "#0b6f82",
      weekend: "#d7f3f6",
      weekendInk: "#0b6575",
    },
    motif: WAVE,
  },
  {
    palette: {
      bg: "#f6f2fa",
      line: "#e2d8ee",
      accent: "#7046a8",
      header: "#653c98",
      weekend: "#ece2f8",
      weekendInk: "#55308a",
    },
    motif: GRAPES,
  },
  {
    palette: {
      bg: "#fbf3ea",
      line: "#ecdcc8",
      accent: "#b4501c",
      header: "#9c4719",
      weekend: "#fde6cf",
      weekendInk: "#8a3f12",
    },
    motif: LEAF,
  },
  {
    palette: {
      bg: "#f7f2ec",
      line: "#e4d9cc",
      accent: "#8f522a",
      header: "#6d4c35",
      weekend: "#efe3d6",
      weekendInk: "#5e3f26",
    },
    motif: CHESTNUT,
  },
  {
    palette: {
      bg: "#f7f4ef",
      line: "#e6ddd0",
      accent: "#2f7d4f",
      header: "#9b1c2c",
      weekend: "#e3f1e6",
      weekendInk: "#22603b",
    },
    motif: STAR,
  },
];

/** The colours of a month, 1 being January. */
export function monthPalette(month: number): MonthPalette {
  return MONTHS[month - 1]!.palette;
}

/** The month's drawing, as SVG markup on a 24-unit square, filled or stroked in `currentColor`. */
export function monthMotif(month: number): string {
  return MONTHS[month - 1]!.motif;
}

/**
 * The month a page is about: the date or month in a calendar view's address, else today's. A
 * week takes the month of its Thursday, the day that decides which month most of it is in.
 */
export function monthOfPath(pathname: string, today: PlainDate): number {
  const [, view, at] = pathname.split("/");
  if (view === "month" && at && /^\d{4}-\d{2}$/.test(at)) return Number(at.slice(5, 7));
  if ((view === "day" || view === "agenda") && at && isPlainDate(at)) return Number(at.slice(5, 7));
  if (view === "week" && at && isPlainDate(at)) {
    const thursday = new Date(`${at}T12:00:00Z`);
    thursday.setUTCDate(thursday.getUTCDate() + ((4 - thursday.getUTCDay() + 7) % 7));
    return thursday.getUTCMonth() + 1;
  }
  return Number(today.slice(5, 7));
}
