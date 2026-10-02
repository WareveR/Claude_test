import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { formatLocale } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import type { EntryTime } from "../../core/entry-time";
import { typeName, useEntryTypes } from "../entry-types/model";
import { occurrenceValues, useEntry } from "../entries/model";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";

function timeText(time: EntryTime, t: (key: string) => string): string {
  if (time.allDay) return t("entries.allDay");
  return time.endTime ? `${time.startTime}–${time.endTime}` : time.startTime;
}

/** An Entry on the wall: read-only, and a Private one shows only "Private" and its time. */
export function EntryDetails() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [search] = useSearchParams();
  const locale = formatLocale(useSignedIn().language);
  const entry = useEntry(id);
  const types = useEntryTypes();
  const persons = usePersons();
  const back = (
    <Link to={paths.display()} className="self-start rounded-md border border-line px-4 py-2">
      {t("display.backToBoard")}
    </Link>
  );
  if (!entry.data) return <main className="flex flex-col gap-4 p-6">{back}</main>;
  const date = search.get("occurrence");
  const shown =
    entry.data.repetition && date && isPlainDate(date)
      ? (occurrenceValues(entry.data, date) ?? entry.data)
      : entry.data;
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6" data-testid="entry-details">
      {back}
      <h1 className="text-2xl font-semibold">
        {shown.private ? t("entries.private") : shown.title}
      </h1>
      <p className="text-lg">
        <span className="first-letter:uppercase">{when}</span> · {timeText(shown.time, t)}
      </p>
      {!shown.private && (
        <>
          {type && <p className="text-muted">{typeName(type, t)}</p>}
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
          {shown.location && <p>{shown.location}</p>}
          {shown.notes && <p className="whitespace-pre-wrap">{shown.notes}</p>}
        </>
      )}
    </main>
  );
}
