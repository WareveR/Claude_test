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
      style={{ ...style, backgroundColor: person.color }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initials(person.name)}
    </span>
  );
}
