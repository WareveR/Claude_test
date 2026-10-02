import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { publicHolidays } from "../../core/holidays";
import type { PlainDate } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";

/** `date-holidays` is large, so it loads on first use rather than with the app. */
function useHolidayLibrary() {
  return useQuery({
    queryKey: ["date-holidays"],
    queryFn: async () => (await import("date-holidays")).default,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data;
}

/**
 * The window's Public Holidays by date, named in the device's language, from the Family's
 * places; empty when this device hides them. They are calculated here, never stored.
 */
export function useHolidays(from: PlainDate, to: PlainDate): Map<PlainDate, string[]> {
  const { family, language } = useSignedIn();
  const { holidays: shown } = usePersonFilter();
  const Library = useHolidayLibrary();
  return useMemo(
    () =>
      Library && shown
        ? publicHolidays(Library, family.holidayPlaces, from, to, language)
        : new Map<PlainDate, string[]>(),
    [Library, shown, family.holidayPlaces, from, to, language],
  );
}
