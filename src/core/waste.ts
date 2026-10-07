/** Kinds of rubbish a municipality collects separately. */
export const BINS = ["general", "packaging", "paper", "glass", "organic"] as const;
export type Bin = (typeof BINS)[number];

/**
 * The Family's rubbish collection: for each bin, the weekdays it is collected
 * (0 = Monday … 6 = Sunday). Shown on the calendar by the Waste Layer.
 */
export type WasteCollection = { bin: Bin; weekdays: number[] }[];

export function isWasteCollection(value: unknown): value is WasteCollection {
  if (!Array.isArray(value) || value.length > BINS.length) return false;
  const seen = new Set<string>();
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const { bin, weekdays } = item as Record<string, unknown>;
    if (!BINS.includes(bin as Bin) || seen.has(bin as string)) return false;
    seen.add(bin as string);
    return (
      Array.isArray(weekdays) &&
      weekdays.length <= 7 &&
      new Set(weekdays).size === weekdays.length &&
      weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    );
  });
}

/** The bins collected on a weekday (0 = Monday), in the fixed order of BINS. */
export function binsOn(collection: WasteCollection, weekday: number): Bin[] {
  return BINS.filter((bin) =>
    collection.some((c) => c.bin === bin && c.weekdays.includes(weekday)),
  );
}
