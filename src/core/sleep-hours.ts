/**
 * The Family's Sleeping Hours: whole hours, from `start` up to `end`, wrapping midnight
 * (23 to 7 is 23:00–07:00). The same start and end means no Sleeping Hours.
 */
export type SleepHours = { start: number; end: number };

export const DEFAULT_SLEEP_HOURS: SleepHours = { start: 23, end: 7 };

const HOURS = 24;

function isHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < HOURS;
}

export function isSleepHours(value: unknown): value is SleepHours {
  if (typeof value !== "object" || value === null) return false;
  const { start, end } = value as Record<string, unknown>;
  return isHour(start) && isHour(end);
}

/** Whether the hour starting at `hour`:00 is a Sleeping Hour. */
export function isSleepHour(sleep: SleepHours, hour: number): boolean {
  if (sleep.start === sleep.end) return false;
  return sleep.start < sleep.end
    ? hour >= sleep.start && hour < sleep.end
    : hour >= sleep.start || hour < sleep.end;
}

/** The hours of the day that some span, in minutes from midnight, touches. */
export function busyHours(spans: { start: number; end: number }[]): Set<number> {
  const busy = new Set<number>();
  for (const { start, end } of spans) {
    for (let h = 0; h < HOURS; h++) {
      const from = h * 60;
      if (start < from + 60 && Math.max(end, start + 1) > from) busy.add(h);
    }
  }
  return busy;
}

/**
 * The height of each hour row: a Sleeping Hour is half as high as a waking one, unless
 * something is on in it, which brings it back to full height.
 */
export function hourHeights(sleep: SleepHours, busy: Set<number>, full: number): number[] {
  return Array.from({ length: HOURS }, (_, h) =>
    isSleepHour(sleep, h) && !busy.has(h) ? full / 2 : full,
  );
}

/** Where each hour row starts, from the top; the 25th is the grid's whole height. */
export function hourTops(heights: number[]): number[] {
  const tops = [0];
  for (const height of heights) tops.push(tops[tops.length - 1] + height);
  return tops;
}

/** The height in the grid of a minute of the day. */
export function yOfMinutes(heights: number[], minutes: number): number {
  const clamped = Math.min(HOURS * 60, Math.max(0, minutes));
  const hour = Math.min(HOURS - 1, Math.floor(clamped / 60));
  return hourTops(heights)[hour] + ((clamped - hour * 60) / 60) * heights[hour];
}

/** The minute of the day at a height in the grid; the reverse of `yOfMinutes`. */
export function minutesAtY(heights: number[], y: number): number {
  let top = 0;
  for (let h = 0; h < HOURS; h++) {
    const height = heights[h];
    if (y < top + height || h === HOURS - 1) {
      const within = Math.min(height, Math.max(0, y - top));
      return h * 60 + (within / height) * 60;
    }
    top += height;
  }
  return HOURS * 60;
}

/**
 * The hour row at the top when the day or week opens: the wake-up hour, or, when something is
 * on in the Sleeping Hours before it, the row just above the earliest of those.
 */
export function openingHour(sleep: SleepHours, busy: Set<number>): number {
  if (sleep.start === sleep.end) return 0;
  for (let h = 0; h < sleep.end; h++) {
    if (isSleepHour(sleep, h) && busy.has(h)) return Math.max(0, h - 1);
  }
  return sleep.end;
}
