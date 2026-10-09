import { Lock, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDisplayMode } from "../display/mode";
import { EntryTypeBadge } from "../entry-types/EntryTypeBadge";
import type { EntryType } from "../entry-types/model";
import { entryPath, type Entry, type Shown } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { Icon } from "../ui/Icon";
import { previewClick, targetOf, usePreview } from "../preview/Preview";

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
  movable = false,
  className = "",
  style,
}: {
  entry: Entry | Shown;
  type: EntryType | undefined;
  persons: Person[];
  label?: string;
  /** It can be dragged to another day or time. */
  movable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const preview = usePreview();
  const href = entryPath(entry);
  const target = targetOf(href);
  // On the wall a Private Entry shows only "Private" and its time.
  const discreet = useDisplayMode() && entry.private;
  const people = entry.personIds
    .map((id) => persons.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
  return (
    <Link
      to={href}
      onClick={target ? previewClick(preview, target) : undefined}
      data-testid="entry"
      data-drag-entry={movable && "key" in entry ? entry.key : undefined}
      style={{ backgroundColor: type?.color ?? "#607d8b", ...style }}
      className={`flex min-w-0 items-start gap-1 overflow-hidden rounded-md px-1 py-0.5 text-xs leading-tight text-white lg:px-1.5 lg:text-sm ${importanceClass(entry)} ${className}`}
    >
      {discreet ? null : entry.icon ? (
        <Icon name={entry.icon} size={12} />
      ) : type?.thumbnailKey ? (
        <EntryTypeBadge type={type} size={12} />
      ) : (
        <Icon name={type?.icon} size={12} />
      )}
      <span className="min-w-0 flex-1">
        {label && <span className="mr-1 tabular-nums opacity-90">{label}</span>}
        <span className="break-words">{discreet ? t("entries.private") : entry.title}</span>
      </span>
      {entry.repetition && (
        <Repeat aria-hidden size={10} strokeWidth={2} className="mt-0.5 shrink-0" />
      )}
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
