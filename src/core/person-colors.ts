/** Colours offered for Persons, chosen to stay legible in light and dark themes. */
export const PERSON_COLORS = [
  "#ffcdd2",
  "#f8bbd0",
  "#e1bee7",
  "#c5cae9",
  "#bbdefb",
  "#b2ebf2",
  "#c8e6c9",
  "#f0f4c3",
  "#ffecb3",
  "#ffccbc",
  "#d7ccc8",
  "#cfd8dc",
];

/** The first colour no Person has yet; once all are taken, they go round again. */
export function freeColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return (
    PERSON_COLORS.find((c) => !taken.has(c)) ?? PERSON_COLORS[used.length % PERSON_COLORS.length]
  );
}
