import { startOfWeek, type PlainDate } from "../core/plain-date";

/** Every view's address carries its date, so back/forward and shared links work. */
export const paths = {
  today: () => "/",
  day: (date: PlainDate) => `/day/${date}`,
  week: (date: PlainDate) => `/week/${startOfWeek(date)}`,
  month: (date: PlainDate) => `/month/${date.slice(0, 7)}`,
  year: (date: PlainDate) => `/year/${date.slice(0, 4)}`,
  agenda: (date: PlainDate) => `/agenda/${date}`,
  display: () => "/display",
  summary: () => "/summary",
  tasks: () => "/tasks",
  shopping: () => "/shopping",
  suggestions: () => "/suggestions",
  search: () => "/search",
  settings: () => "/settings",
  settingsArea: (area: string) => `/settings/${area}`,
  errorLog: () => "/settings/errors",
};
