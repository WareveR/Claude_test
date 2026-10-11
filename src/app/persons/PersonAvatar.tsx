import { initials, type Person } from "./model";

/** A Person as a round avatar: their photo, or their initials on their colour. */
export function PersonAvatar({
  person,
  size = 32,
}: {
  person: Pick<Person, "name" | "color" | "photoKey">;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (person.photoKey) {
    return (
      <img
        src={`/api/images/${person.photoKey}`}
        alt={person.name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={person.name}
      style={{ ...style, backgroundColor: person.color, color: inkOn(person.color) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initials(person.name)}
    </span>
  );
}

/** Dark initials on the light pastel palette, white on anything darker. */
function inkOn(color: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#1f2937" : "#fff";
}
