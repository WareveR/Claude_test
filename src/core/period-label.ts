import { formatPlainDate, type PlainDate } from "./plain-date";

/** What a Period Curtain names: a day, a run of days (a week, the agenda), a month or a year. */
export type PeriodKind = "day" | "range" | "month" | "year";

const capitalise = (text: string, language: string) =>
  text.charAt(0).toLocaleUpperCase(language) + text.slice(1);

/** "26 Outubro" / "26 October": day and month name in the language's order, without "de". */
function dayMonth(date: PlainDate, language: string): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", timeZone: "UTC" })
    .formatToParts(new Date(`${date}T00:00:00Z`))
    .filter((p) => p.type === "day" || p.type === "month")
    .map((p) => (p.type === "month" ? capitalise(p.value, language) : p.value))
    .join(" ");
}

/**
 * The lines a Period Curtain shows for a period, biggest first: "2027"; "Novembro 2026";
 * "26 Outubro" / "1 Novembro" / "2026" (each with its year when the days span two years);
 * "Segunda, 26 Outubro 2026".
 */
export function periodLabel(
  kind: PeriodKind,
  from: PlainDate,
  to: PlainDate,
  language: string,
): string[] {
  const year = from.slice(0, 4);
  if (kind === "year") return [year];
  if (kind === "month") {
    const month = formatPlainDate(from, language, { month: "long" });
    return [`${capitalise(month, language)} ${year}`];
  }
  if (kind === "day") {
    // Portuguese names the weekday in full ("segunda-feira"); the curtain says it short, "Segunda".
    const day = formatPlainDate(from, language, { weekday: "long" }).replace(/-feira$/, "");
    return [`${capitalise(day, language)}, ${dayMonth(from, language)} ${year}`];
  }
  const toYear = to.slice(0, 4);
  if (toYear !== year)
    return [`${dayMonth(from, language)} ${year}`, `${dayMonth(to, language)} ${toYear}`];
  return [dayMonth(from, language), dayMonth(to, language), year];
}
