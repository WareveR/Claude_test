/** How much a button or field explains about itself when hovered or long-pressed. */
export const HELP_LEVELS = ["off", "low", "medium", "high"] as const;
export type HelpLevel = (typeof HELP_LEVELS)[number];

export interface HelpTip {
  name: string;
  what: string | null;
  more: string | null;
}

/**
 * What a tip shows at a level, or null for no tip.
 * - low: only the name, and only where the screen doesn't already show it (an icon button);
 * - medium: the name and what it does;
 * - high: that and what follows from using it.
 */
export function helpTip(
  level: HelpLevel,
  item: { name: string; showsName: boolean; what: string | null; more: string | null },
): HelpTip | null {
  const name = item.name.trim();
  if (level === "off" || name === "") return null;
  if (level === "low") return item.showsName ? null : { name, what: null, more: null };
  const what = item.what;
  const more = level === "high" ? item.more : null;
  if (what === null && more === null && item.showsName) return null;
  return { name, what, more };
}
