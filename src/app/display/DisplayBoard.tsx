import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AUTO_RETURN_MS, boardDays } from "../../core/display";
import { daySpan } from "../../core/entry-time";
import { formatLocale } from "../../core/languages";
import { matchesFilter } from "../../core/person-filter";
import { formatPlainDate, minutesNowIn } from "../../core/plain-date";
import { entriesOn } from "../calendar/MonthGrid";
import { importanceClass } from "../calendar/EntryBlock";
import { useEntryTypes } from "../entry-types/model";
import { entryPath, useOccurrences, type Shown } from "../entries/model";
import { useSignedIn } from "../family";
import { FilterButton } from "../filter/FilterButton";
import { usePersonFilter } from "../filter/model";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { GRID_BOX, SidePanelLayout, TodayPanel } from "../shell/SidePanel";
import { useNow } from "../shell/useNow";
import { CalendarGrid } from "../views/Views";
import { ForecastButton } from "../weather/ForecastButton";
import { useForecastDays } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { useRolloverToday } from "./hooks";

/** Today's Entries as a large list; the ones already over are dimmed. */
function TodayEntries({ today }: { today: string }) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = useNow(60_000);
  const nowMinutes = minutesNowIn(family.timeZone, now);
  const filter = usePersonFilter();
  const types = useEntryTypes().data ?? [];
  const persons = usePersons().data ?? [];
  const occurrences = useOccurrences(today, today).data ?? [];
  const entries = entriesOn(
    occurrences.filter((e) => matchesFilter(e.personIds, filter)),
    today,
  ) as Shown[];
  return (
    <section className="mx-4 flex flex-col gap-2" aria-label={t("display.today")}>
      <h2 className="text-lg font-semibold">{t("display.today")}</h2>
      {entries.length === 0 && <p className="text-muted">{t("views.nothing")}</p>}
      {entries.map((entry) => {
        const span = entry.time.allDay ? null : daySpan(entry.time, today);
        const past = span !== null && span.end <= nowMinutes;
        const type = types.find((ty) => ty.id === entry.entryTypeId);
        const people = entry.personIds
          .map((id) => persons.find((p) => p.id === id))
          .filter((p) => p !== undefined);
        return (
          <Link
            key={entry.key}
            to={entryPath(entry)}
            data-testid="today-entry"
            data-past={past || undefined}
            className={`flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 ${past ? "opacity-50" : ""} ${importanceClass(entry)}`}
          >
            <span
              aria-hidden
              className="w-1 self-stretch rounded"
              style={{ backgroundColor: type?.color ?? "#607d8b" }}
            />
            <span className="w-14 shrink-0 text-sm text-muted tabular-nums">
              {entry.time.allDay ? t("entries.allDay") : entry.time.startTime}
            </span>
            <span className="min-w-0 flex-1 break-words font-medium">
              {entry.private ? t("entries.private") : entry.title}
            </span>
            <span className="flex -space-x-1">
              {people.map((p) => (
                <PersonAvatar key={p.id} person={{ ...p, photoKey: null }} size={24} />
              ))}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

/**
 * Display Mode: today on the left, always, on a wide screen (above the grid on a narrower one); a
 * seven-day time grid starting today, movable a week at a time and back to today by itself after
 * three untouched minutes.
 */
export function DisplayBoard() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const today = useRolloverToday(family.timeZone);
  const forecast = useForecastDays();
  const [weeksAway, setWeeksAway] = useState(0);
  const [touches, setTouches] = useState(0);
  useEffect(() => {
    if (weeksAway === 0) return;
    const id = setTimeout(() => setWeeksAway(0), AUTO_RETURN_MS);
    return () => clearTimeout(id);
  }, [weeksAway, touches]);

  const days = boardDays(today, weeksAway);
  const short = { day: "numeric", month: "short" } as const;
  const title = `${formatPlainDate(days[0], locale, short)} – ${formatPlainDate(days[6], locale, short)}`;
  const arrow = "rounded-md p-2 hover:bg-surface";
  return (
    <div
      data-testid="display-board"
      className="flex flex-col lg:min-h-0 lg:flex-1"
      onPointerDownCapture={() => setTouches((n) => n + 1)}
      onScrollCapture={() => setTouches((n) => n + 1)}
    >
      <SidePanelLayout
        wideAt="lg"
        panel={
          <TodayPanel readOnly>
            <TodayEntries today={today} />
          </TodayPanel>
        }
      >
        <nav className="flex flex-wrap items-center gap-2 px-4 py-2">
          <button
            type="button"
            aria-label={t("views.previous")}
            className={arrow}
            onClick={() => setWeeksAway((w) => w - 1)}
          >
            <ChevronLeft aria-hidden size={24} strokeWidth={1.75} />
          </button>
          <h1 className="text-xl font-semibold" data-testid="board-range">
            {title}
          </h1>
          <button
            type="button"
            aria-label={t("views.next")}
            className={arrow}
            onClick={() => setWeeksAway((w) => w + 1)}
          >
            <ChevronRight aria-hidden size={24} strokeWidth={1.75} />
          </button>
          {weeksAway !== 0 && (
            <button
              type="button"
              data-testid="back-to-today"
              className="rounded-full bg-accent px-4 py-1 font-medium text-accent-ink"
              onClick={() => setWeeksAway(0)}
            >
              {t("display.otherWeek")}
            </button>
          )}
          <div className="ml-auto">
            <FilterButton />
          </div>
        </nav>
        <div className={GRID_BOX.lg}>
          {/* On a phone the seven days keep a readable width and scroll sideways. */}
          <div className="relative flex min-h-0 flex-1 overflow-x-auto">
            <div
              data-testid="wall-days"
              className="flex min-h-0 min-w-[46rem] flex-1 flex-col md:min-w-0"
            >
              <CalendarGrid
                days={days}
                readOnly
                dayExtra={(day) => {
                  const weather = forecast.get(day);
                  return (
                    weather && (
                      <div data-testid={`week-weather-${day}`}>
                        <ForecastButton>
                          <WeatherBadge
                            day={weather}
                            faded={weather.faded}
                            size={16}
                            rain
                            className="flex-wrap justify-center text-xs"
                          />
                        </ForecastButton>
                      </div>
                    )
                  );
                }}
              />
            </div>
          </div>
        </div>
      </SidePanelLayout>
    </div>
  );
}
