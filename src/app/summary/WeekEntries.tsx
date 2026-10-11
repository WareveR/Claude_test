import { useTranslation } from "react-i18next";
import { daySpan } from "../../core/entry-time";
import { formatLocale } from "../../core/languages";
import { matchesFilter } from "../../core/person-filter";
import { addDays, formatPlainDate, minutesNowIn, todayIn } from "../../core/plain-date";
import { importanceClass } from "../calendar/EntryBlock";
import { entriesOn } from "../calendar/MonthGrid";
import { useEntryTypes } from "../entry-types/model";
import { entryPath, useOccurrences, type Shown } from "../entries/model";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { EntryLink } from "../shell/ItemPopup";
import { useNow } from "../shell/useNow";

/**
 * The next seven days' Entries as a list, day by day from today; today's that are already over are
 * dimmed. Days with nothing are left out.
 */
export function WeekEntries() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const now = useNow(60_000);
  const today = todayIn(family.timeZone, now);
  const nowMinutes = minutesNowIn(family.timeZone, now);
  const last = addDays(today, 6);
  const filter = usePersonFilter();
  const types = useEntryTypes().data ?? [];
  const persons = usePersons().data ?? [];
  const occurrences = (useOccurrences(today, last).data ?? []).filter((e) =>
    matchesFilter(e.personIds, filter),
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    .map((day) => ({ day, entries: entriesOn(occurrences, day) as Shown[] }))
    .filter(({ entries }) => entries.length > 0);
  const dayName = (day: string) =>
    day === today
      ? t("display.today")
      : day === addDays(today, 1)
        ? t("summary.tomorrow")
        : formatPlainDate(day, locale, { weekday: "long", day: "numeric" });
  return (
    <section
      data-testid="week-entries"
      aria-labelledby="week-entries-title"
      className="mx-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
    >
      <h2 id="week-entries-title" className="text-lg font-semibold">
        {t("summary.nextDays")}
      </h2>
      {days.length === 0 && <p className="text-muted">{t("views.nothing")}</p>}
      {days.map(({ day, entries }) => (
        <div key={day} className="flex flex-col gap-1.5" data-testid={`week-entries-${day}`}>
          <h3 className="text-sm font-semibold text-muted first-letter:uppercase">
            {dayName(day)}
          </h3>
          {entries.map((entry) => {
            const span = entry.time.allDay ? null : daySpan(entry.time, day);
            const past = day === today && span !== null && span.end <= nowMinutes;
            const type = types.find((ty) => ty.id === entry.entryTypeId);
            const people = entry.personIds
              .map((id) => persons.find((p) => p.id === id))
              .filter((p) => p !== undefined);
            return (
              <EntryLink
                key={entry.key}
                entry={entry}
                to={entryPath(entry)}
                data-testid="today-entry"
                data-past={past || undefined}
                className={`flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2 ${past ? "opacity-50" : ""} ${importanceClass(entry)}`}
              >
                <span
                  aria-hidden
                  className="w-1 self-stretch rounded"
                  style={{ backgroundColor: type?.color ?? "#607d8b" }}
                />
                <span className="w-14 shrink-0 text-sm text-muted tabular-nums">
                  {entry.time.allDay ? t("entries.allDay") : entry.time.startTime}
                </span>
                <span className="min-w-0 flex-1 font-medium break-words">
                  {entry.private ? t("entries.private") : entry.title}
                </span>
                <span className="flex -space-x-1">
                  {people.map((p) => (
                    <PersonAvatar key={p.id} person={{ ...p, photoKey: null }} size={24} />
                  ))}
                </span>
              </EntryLink>
            );
          })}
        </div>
      ))}
    </section>
  );
}
