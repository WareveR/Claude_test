/**
 * A device's Person Filter: the Persons picked (none picked shows everyone) and whether
 * Family-wide items, those for no Person in particular, are included.
 */
export type PersonFilter = { personIds: string[]; familyWide: boolean };

export const NO_FILTER: PersonFilter = { personIds: [], familyWide: true };

/** Whether an Entry or Task for these Persons shows: any-of the picked, or Family-wide. */
export function matchesFilter(itemPersonIds: string[], filter: PersonFilter): boolean {
  if (itemPersonIds.length === 0) return filter.familyWide;
  return filter.personIds.length === 0 || itemPersonIds.some((id) => filter.personIds.includes(id));
}

/** A Checklist shows when any of its Tasks matches; an empty one counts as Family-wide. */
export function checklistMatches(taskPersonIds: string[][], filter: PersonFilter): boolean {
  if (taskPersonIds.length === 0) return filter.familyWide;
  return taskPersonIds.some((ids) => matchesFilter(ids, filter));
}

export function isFiltering(filter: PersonFilter): boolean {
  return filter.personIds.length > 0 || !filter.familyWide;
}

/** Reads a stored filter defensively: anything unexpected means no filter. */
export function parseFilter(value: unknown): PersonFilter {
  if (typeof value !== "object" || value === null) return NO_FILTER;
  const v = value as Record<string, unknown>;
  const personIds = Array.isArray(v.personIds)
    ? v.personIds.filter((id): id is string => typeof id === "string")
    : [];
  return { personIds, familyWide: v.familyWide !== false };
}
