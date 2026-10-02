import { startOfWeek, type PlainDate } from "../core/plain-date";

/** Every view's address carries its date, so back/forward and shared links work. */
export const paths = {
  today: () => "/",
  day: (date: PlainDate) => `/day/${date}`,
  week: (date: PlainDate) => `/week/${startOfWeek(date)}`,
  month: (date: PlainDate) => `/month/${date.slice(0, 7)}`,
  year: (date: PlainDate) => `/year/${date.slice(0, 4)}`,
  tasks: () => "/tasks",
  settings: () => "/settings",
  errorLog: () => "/settings/errors",
};
