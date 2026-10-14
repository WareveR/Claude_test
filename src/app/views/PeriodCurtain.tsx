import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PlainDate } from "../../core/plain-date";
import { monthMotif } from "../../core/month-theme";
import { MonthMotif, useMonthOnScreen } from "../month-theme";
import { entriesKey } from "../entries/model";

/** The curtain stays at least this long, so every move through the dates feels the same. */
export const CURTAIN_MIN_MS = 1000;
/** Past this the curtain lifts even when the Entries have not come. */
export const CURTAIN_MAX_MS = 4000;
const FADE_OUT_MS = 300;

/**
 * Whether the Entries of a window have come (or failed): the same query `useOccurrences` reads,
 * watched in the query cache so it neither fetches nor waits on its own.
 */
export function usePeriodReady(from: PlainDate, to: PlainDate): boolean {
  const client = useQueryClient();
  const subscribe = useCallback(
    (changed: () => void) => client.getQueryCache().subscribe(changed),
    [client],
  );
  return useSyncExternalStore(subscribe, () => {
    const state = client.getQueryState(entriesKey(from, to));
    return state !== undefined && state.status !== "pending";
  });
}

type Shown = { period: string; held: boolean; overdue: boolean };

/**
 * The Period Curtain: when a view moves to another day, week, month or year, the new period's name
 * fades in large over the view's body (below its nav, which stays usable), holds at least a second
 * and until the period's Entries have come, then fades out with them already drawn. A view opened
 * afresh shows it only while its Entries are still to come; refetches of the same period never do.
 * Swipes and clicks go through it.
 */
export function PeriodCurtain({
  period,
  lines,
  from,
  to,
}: {
  /** Names the period, such as "month:2026-11"; the curtain shows when it changes. */
  period: string;
  lines: string[];
  from: PlainDate;
  to: PlainDate;
}) {
  const ready = usePeriodReady(from, to);
  const month = useMonthOnScreen();
  const [shown, setShown] = useState<Shown | null>(() =>
    ready ? null : { period, held: false, overdue: false },
  );
  const [last, setLast] = useState(period);
  if (last !== period) {
    setLast(period);
    setShown({ period, held: false, overdue: false });
  }
  const visible = shown !== null && !shown.overdue && !(shown.held && ready);

  // The least and the most it stays, from when it shows.
  const showing = shown?.period;
  useEffect(() => {
    if (showing === undefined) return;
    const mark = (change: Partial<Shown>) =>
      setShown((s) => (s?.period === showing ? { ...s, ...change } : s));
    const held = setTimeout(() => mark({ held: true }), CURTAIN_MIN_MS);
    const overdue = setTimeout(() => mark({ overdue: true }), CURTAIN_MAX_MS);
    return () => {
      clearTimeout(held);
      clearTimeout(overdue);
    };
  }, [showing]);

  // Once faded out it leaves the page, so its words are not found twice.
  const leaving = shown !== null && !visible;
  useEffect(() => {
    if (!leaving) return;
    const gone = setTimeout(() => setShown(null), FADE_OUT_MS);
    return () => clearTimeout(gone);
  }, [leaving]);

  // It covers what is below the view's nav, on screen, however far the page has scrolled.
  const box = useRef<HTMLDivElement>(null);
  const present = shown !== null;
  useLayoutEffect(() => {
    if (!present) return;
    const place = () => {
      const el = box.current;
      const nav = document.querySelector("[data-view-nav]")?.getBoundingClientRect();
      if (!el) return;
      el.style.top = `${nav ? Math.max(nav.bottom, 0) : 0}px`;
      el.style.left = `${nav?.left ?? 0}px`;
      el.style.width = nav ? `${nav.width}px` : "100%";
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [present]);

  return (
    <div
      ref={box}
      aria-live="polite"
      data-testid={present ? "period-curtain" : undefined}
      className={`pointer-events-none fixed bottom-0 z-[19] flex flex-col items-center justify-center gap-1 overflow-hidden bg-surface/85 px-4 text-center text-ink backdrop-blur-sm transition-[opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none ${
        visible ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      {present && month !== null && (
        <>
          {/* With the Month theme: the season scattered faintly behind, and large above the name. */}
          <MonthMotif month={month} opacity={0.12} className="absolute inset-0 text-header" />
          <svg
            aria-hidden
            data-testid="curtain-season"
            viewBox="0 0 24 24"
            className="mb-3 size-24 text-header opacity-70 md:size-32"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0"
            dangerouslySetInnerHTML={{ __html: monthMotif(month) }}
          />
        </>
      )}
      {present &&
        lines.map((line, i) => (
          // Every line the same size, whatever the view, so each move looks alike.
          <span
            key={i}
            className={`text-4xl font-semibold tracking-tight tabular-nums md:text-6xl ${
              i > 0 && /^\d{4}$/.test(line) ? "text-muted" : ""
            }`}
          >
            {line}
          </span>
        ))}
    </div>
  );
}
