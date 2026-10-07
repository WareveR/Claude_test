/**
 * The one look for every action and every way to move around that isn't a tab or an icon:
 * a bordered button. Links styled with these read as buttons too, never as underlined text.
 */
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50";

export const BUTTON = `${BASE} border-line bg-surface hover:bg-line/60`;
export const BUTTON_PRIMARY = `${BASE} border-accent bg-accent text-accent-ink hover:opacity-90`;
export const BUTTON_DANGER = `${BASE} border-overdue bg-surface text-overdue hover:bg-overdue/10`;
