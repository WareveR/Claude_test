/**
 * What Settings › Danger zone can delete. "Start again as a new Family" ticks them all; the
 * Family Password, the recovery email and the Signed-in Devices always stay.
 */
export const RESET_PARTS = [
  "entries",
  "tasks",
  "shopping",
  "persons",
  "entryTypes",
  "templates",
  "settings",
  "errors",
] as const;
export type ResetPart = (typeof RESET_PARTS)[number];
