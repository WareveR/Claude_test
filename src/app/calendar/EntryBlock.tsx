import { Lock } from "lucide-react";
import { Link } from "react-router";
import { EntryTypeBadge } from "../entry-types/EntryTypeBadge";
import type { EntryType } from "../entry-types/model";
import type { Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { Icon } from "../ui/Icon";

/** How Importance shows: High bolder, Low lighter (assembly default). */
export function importanceClass(entry: Pick<Entry, "importance">) {
  if (entry.importance === "high") return "font-bold ring-2 ring-ink/60";
  if (entry.importance === "low") return "opacity-55";
  return "";
}

/** An Entry filled with its Entry Type's colour, with its icon, title and Persons' avatars. */
export function EntryBlock({
  entry,
  type,
  persons,
  label,
  className = "",
  style,
}: {
  entry: Entry;
  type: EntryType | undefined;
  persons: Person[];
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const people = entry.personIds
    .map((id) => persons.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
  return (
    <Link
      to={`/entries/${entry.id}`}
      data-testid="entry"
      style={{ backgroundColor: type?.color ?? "#607d8b", ...style }}
      className={`flex min-w-0 items-start gap-1 overflow-hidden rounded-md px-1 py-0.5 text-[11px] leading-tight text-white ${importanceClass(entry)} ${className}`}
    >
      {entry.icon ? (
        <Icon name={entry.icon} size={12} />
      ) : type?.thumbnailKey ? (
        <EntryTypeBadge type={type} size={12} />
      ) : (
        <Icon name={type?.icon} size={12} />
      )}
      <span className="min-w-0 flex-1">
        {label && <span className="mr-1 tabular-nums opacity-90">{label}</span>}
        <span className="break-words">{entry.title}</span>
      </span>
      {entry.private && <Lock aria-hidden size={10} strokeWidth={2} className="mt-0.5 shrink-0" />}
      {people.length > 0 && (
        <span className="flex shrink-0 -space-x-1">
          {people.map((p) => (
            <PersonAvatar key={p.id} person={{ ...p, photoKey: null }} size={14} />
          ))}
        </span>
      )}
    </Link>
  );
}
