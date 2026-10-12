import { Lock, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EntryLink } from "../shell/ItemPopup";
import { useDisplayMode } from "../display/mode";
import { EntryTypeBadge } from "../entry-types/EntryTypeBadge";
import type { EntryType } from "../entry-types/model";
import { entryPath, type Entry, type Shown } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { Icon } from "../ui/Icon";

/** How Importance shows: High bolder, Low lighter (assembly default). */
export function importanceClass(entry: Pick<Entry, "importance">) {
  if (entry.importance === "high") return "font-bold ring-2 ring-ink/60";
  if (entry.importance === "low") return "opacity-55";
  return "";
}

/** An Entry's own icon, else its Entry Type's picture or icon. */
export function EntryIcon({
  entry,
  type,
  size,
}: {
  entry: Pick<Entry, "icon">;
  type: EntryType | undefined;
  size: number;
}) {
  if (entry.icon) return <Icon name={entry.icon} size={size} />;
  if (type?.thumbnailKey) return <EntryTypeBadge type={type} size={size} />;
  return <Icon name={type?.icon} size={size} />;
}

/** An Entry filled with its Entry Type's colour, with its icon, title and Persons' avatars. */
export function EntryBlock({
  entry,
  type,
  persons,
  label,
  labelWide = false,
  movable = false,
  className = "",
  style,
}: {
  entry: Entry | Shown;
  type: EntryType | undefined;
  persons: Person[];
  label?: string;
  /** Show `label` only on wide screens: a narrow week column needs its width for the title. */
  labelWide?: boolean;
  /** It can be dragged to another day or time. */
  movable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  // On the wall a Private Entry shows only "Private" and its time.
  const discreet = useDisplayMode() && entry.private;
  const people = entry.personIds
    .map((id) => persons.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
  const marks = (entry.repetition || entry.private || people.length > 0) && (
    <>
      {entry.repetition && <Repeat aria-hidden size={10} strokeWidth={2} />}
      {entry.private && <Lock aria-hidden size={10} strokeWidth={2} />}
      {people.length > 0 && (
        <span className="flex -space-x-1">
          {people.map((p) => (
            <PersonAvatar key={p.id} person={{ ...p, photoKey: null }} size={14} />
          ))}
        </span>
      )}
    </>
  );
  return (
    <EntryLink
      entry={entry}
      to={entryPath(entry)}
      data-testid="entry"
      data-drag-entry={movable && "key" in entry ? entry.key : undefined}
      style={{ backgroundColor: type?.color ?? "#607d8b", ...style }}
      className={`flex min-w-0 items-start gap-1 overflow-hidden rounded-md px-1 py-0.5 text-xs leading-tight text-white hyphens-auto lg:px-1.5 lg:text-sm ${importanceClass(entry)} ${className}`}
    >
      {discreet ? null : <EntryIcon entry={entry} type={type} size={12} />}
      <span data-entry-text className="min-w-0 flex-1 overflow-hidden">
        {/* Without a time (all-day and multi-day bars) the marks float right and the title flows
            around them, so in a narrow column it has the whole width from its second line on. */}
        {(!label || labelWide) && marks && (
          <span
            className={`float-right ml-1 flex items-center gap-0.5 ${label ? "lg:hidden" : ""}`}
          >
            {marks}
          </span>
        )}
        {label && (
          <span className={`mr-1 tabular-nums opacity-90 ${labelWide ? "hidden lg:inline" : ""}`}>
            {label}
          </span>
        )}
        {/* Whole words (hyphenated where the language allows), never cut letters apart. */}
        <span>{discreet ? t("entries.private") : entry.title}</span>
      </span>
      {/* With a time the block is often one line tall: the marks keep to its right. */}
      {label && marks && (
        <span
          className={`mt-0.5 shrink-0 items-center gap-0.5 ${labelWide ? "hidden lg:flex" : "flex"}`}
        >
          {marks}
        </span>
      )}
    </EntryLink>
  );
}
