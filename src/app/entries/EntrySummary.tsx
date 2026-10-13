import { AlertTriangle, Bell, Clock, MapPin, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EntryTime } from "../../core/entry-time";
import { formatLocale } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import { relativeWhen } from "../../core/relative-when";
import { familyNow } from "../../core/task";
import { EntryTypeBadge } from "../entry-types/EntryTypeBadge";
import { reminderLabel, typeName, useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useNow } from "../shell/useNow";
import { EntryShopping } from "../shopping/EntryShopping";
import { EntryPreparation } from "./EntryPreparation";
import { occurrenceValues, useEntry } from "./model";

function timeText(time: EntryTime, t: (key: string) => string): string {
  if (time.allDay) return t("entries.allDay");
  return time.endTime ? `${time.startTime}–${time.endTime}` : time.startTime;
}

/**
 * An Entry to read: its type, title, when, Persons, place and notes; for a repeating Entry,
 * the Occurrence on `occurrence`, how soon it is, how it repeats, its Reminders, and what it
 * needs done beforehand, only to read: changes are made in the Entry's form. With `discreet` (the wall),
 * a Private Entry shows only "Private" and when, and the preparation stays out.
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
  const { language, family } = useSignedIn();
  const locale = formatLocale(language);
  const now = familyNow(family.timeZone, useNow(60_000));
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
  const time = shown.time;
  const soon = relativeWhen(
    { date: time.startDate, time: time.allDay ? null : time.startTime },
    {
      date: time.endDate ?? time.startDate,
      time: time.allDay ? null : (time.endTime ?? time.startTime),
    },
    now,
    locale,
  );
  const repetition = entry.data.repetition;
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
      <p className="flex items-center gap-1.5 font-medium" data-testid="entry-when">
        <Clock aria-hidden size={18} className="shrink-0 text-muted" />
        <span className="first-letter:uppercase">
          {soon.kind === "now"
            ? t("entries.happeningNow")
            : soon.time
              ? t("entries.relativeAt", { when: soon.text, time: soon.time })
              : soon.text}
        </span>
      </p>
      {!hidden && (
        <>
          {repetition && (
            <p className="flex items-center gap-1.5">
              <Repeat aria-hidden size={18} className="shrink-0 text-muted" />
              {t(`entries.every.${repetition.frequency}`, { count: repetition.interval })}
            </p>
          )}
          {entry.data.reminders.length > 0 && (
            <p className="flex items-center gap-1.5">
              <Bell aria-hidden size={18} className="shrink-0 text-muted" />
              {[...entry.data.reminders]
                .sort((a, b) => b - a)
                .map((m) => reminderLabel(m, t))
                .join(", ")}
            </p>
          )}
          {shown.importance === "high" && (
            <p className="flex items-center gap-1.5 text-overdue">
              <AlertTriangle aria-hidden size={18} className="shrink-0" />
              {t("entries.importantHigh")}
            </p>
          )}
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
          {shown.location && (
            <p className="flex items-start gap-1.5">
              <MapPin
                aria-hidden
                size={18}
                strokeWidth={2}
                color="#ef4444"
                className="mt-0.5 shrink-0"
              />
              {shown.location}
            </p>
          )}
          {shown.notes && <p className="whitespace-pre-wrap">{shown.notes}</p>}
        </>
      )}
      {!discreet && <EntryPreparation entryId={id} readOnly />}
      {!discreet && <EntryShopping title={shown.title} type={type?.builtinKey ?? null} />}
    </div>
  );
}
