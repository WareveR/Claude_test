import { useTranslation } from "react-i18next";
import type { EntryTime } from "../../core/entry-time";
import { formatLocale } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import { EntryTypeBadge } from "../entry-types/EntryTypeBadge";
import { typeName, useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { occurrenceValues, useEntry } from "./model";

function timeText(time: EntryTime, t: (key: string) => string): string {
  if (time.allDay) return t("entries.allDay");
  return time.endTime ? `${time.startTime}–${time.endTime}` : time.startTime;
}

/**
 * An Entry to read: its type, title, when, Persons, place and notes; for a repeating Entry,
 * the Occurrence on `occurrence`. With `discreet`, a Private Entry shows only "Private" and when.
 */
export function EntrySummary({
  id,
  occurrence,
  discreet = false,
  titleId,
}: {
  id: string;
  occurrence?: string | null;
  discreet?: boolean;
  /** The heading's id, for a dialog to name itself by. */
  titleId?: string;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const entry = useEntry(id);
  const types = useEntryTypes();
  const persons = usePersons();
  if (!entry.data) return null;
  const shown =
    entry.data.repetition && occurrence && isPlainDate(occurrence)
      ? (occurrenceValues(entry.data, occurrence) ?? entry.data)
      : entry.data;
  const hidden = discreet && shown.private;
  const day = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const;
  const when = [
    formatPlainDate(shown.time.startDate, locale, day),
    shown.time.endDate && shown.time.endDate !== shown.time.startDate
      ? `– ${formatPlainDate(shown.time.endDate, locale, day)}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const type = types.data?.find((ty) => ty.id === shown.entryTypeId);
  const people = shown.personIds
    .map((pid) => persons.data?.find((p) => p.id === pid))
    .filter((p) => p !== undefined);
  return (
    <div className="flex flex-col gap-3" data-testid="entry-summary">
      <div className="flex items-center gap-3">
        {type && !hidden && <EntryTypeBadge type={type} size={36} />}
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold break-words">
            {hidden ? t("entries.private") : shown.title}
          </h2>
          {type && !hidden && <p className="text-sm text-muted">{typeName(type, t)}</p>}
        </div>
      </div>
      <p>
        <span className="first-letter:uppercase">{when}</span> · {timeText(shown.time, t)}
      </p>
      {!hidden && (
        <>
          {people.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <PersonAvatar person={p} size={28} />
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          {shown.location && <p>📍 {shown.location}</p>}
          {shown.notes && <p className="whitespace-pre-wrap">{shown.notes}</p>}
        </>
      )}
    </div>
  );
}
