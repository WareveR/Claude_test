import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { neighbourWindows, periodWindow, type Period } from "../../core/periods";
import { todayIn, type PlainDate } from "../../core/plain-date";
import { entriesQuery, useEntries } from "../entries/model";
import { useSignedIn } from "../family";
import { pastWeatherQuery } from "../weather/model";

/** How long a period stays on screen before its neighbours load, so quick swipes ask nothing. */
export const PREFETCH_DELAY = 300;

/**
 * Loads the periods either side of the one shown, with the same requests their views make, once
 * the shown one has loaded and stayed a moment: stepping with the arrows or a swipe then draws its
 * Entries at once. Answers still fresh are not asked for again.
 */
export function usePrefetchNeighbours(
  period: Period,
  first: PlainDate,
  { weather = true }: { weather?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const { timeZone } = useSignedIn().family;
  const current = periodWindow(period, first);
  const shown = useEntries(current.from, current.to);
  const loaded = shown.isSuccess && !shown.isFetching;
  // Once per period shown: the minute's refresh of the shown one doesn't load them again.
  const done = useRef("");
  useEffect(() => {
    const at = `${period}:${first}`;
    if (!loaded || done.current === at) return;
    const timer = setTimeout(() => {
      done.current = at;
      const today = todayIn(timeZone);
      for (const { from, to } of neighbourWindows(period, first)) {
        void queryClient.prefetchQuery(entriesQuery(from, to));
        const past = pastWeatherQuery(from, to, today);
        if (weather && past.enabled) void queryClient.prefetchQuery(past);
      }
    }, PREFETCH_DELAY);
    return () => clearTimeout(timer);
  }, [loaded, period, first, timeZone, weather, queryClient]);
}
