/** The UI languages of v1. Both use dd/mm/yyyy, Monday first and a 24-hour clock. */
export const LANGUAGES = ["pt-PT", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The Intl locale used for dates and times: English uses British formats (dd/mm/yyyy, 24-hour). */
export function formatLocale(language: Language): string {
  return language === "en" ? "en-GB" : "pt-PT";
}
