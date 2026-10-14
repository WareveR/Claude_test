import { ChevronDown, Lock, Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatPlainDate, type PlainDate } from "../../core/plain-date";
import { entryPath, type Shown as Entry } from "../entries/model";
import { EntrySummary } from "../entries/EntrySummary";
import type { EntryType } from "../entry-types/model";
import { NoteLine } from "../layers/NoteLine";
import { paths } from "../paths";
import { TasksAccordion } from "../tasks/TasksAccordion";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { ForecastButton } from "../weather/ForecastButton";
import type { ShownDay } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { importanceClass } from "./EntryBlock";
import { TODAY_PILL } from "./today";

/**
 * A day picked in the month or year view, over the page: its weather, holidays, notes and Tasks,
 * then its Entries as an accordion, each opening to its details. Esc closes it too.
 */
export function DayPopup({
  day,
  entries,
  types,
  locale,
  holidays,
  notes,
  forecast,
  today = false,
  onClose,
}: {
  day: PlainDate;
  /** The day's Entries, in the order they show. */
  entries: Entry[];
  types: EntryType[];
  locale: string;
  holidays?: string[];
  notes?: string[];
  forecast?: ShownDay;
  /** Whether the day is today, which then stands out as in the views. */
  today?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const colorOf = (e: Entry) => types.find((ty) => ty.id === e.entryTypeId)?.color ?? "#607d8b";
  // On the body: the header's stacking would otherwise trap this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-popup-title"
        data-testid="picked-day"
        className="flex max-h-[85dvh] w-full max-w-md flex-col gap-2 overflow-y-auto rounded-t-2xl bg-frame p-5 sm:rounded-2xl"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="day-popup-title" className="text-lg font-semibold first-letter:uppercase">
            {formatPlainDate(day, locale, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {today && (
            <span data-testid="day-popup-today" className={`text-sm font-semibold ${TODAY_PILL}`}>
              {t("views.today")}
            </span>
          )}
          {forecast && (
            <ForecastButton>
              <WeatherBadge day={forecast} faded={forecast.faded} rain />
            </ForecastButton>
          )}
        </div>
        {holidays && <p className="text-sm text-holiday-ink">{holidays.join(" · ")}</p>}
        {notes?.map((note) => (
          <p key={note} className="text-sm text-muted">
            <NoteLine note={note} size={14} />
          </p>
        ))}
        <div className="-mx-5">
          <TasksAccordion from={day} to={day} />
        </div>
        {entries.length === 0 && <p className="text-sm text-muted">{t("views.nothing")}</p>}
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => {
            const expanded = open === e.key;
            return (
              <li key={e.key} className="overflow-hidden rounded-lg border border-line">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : e.key)}
                  style={{ backgroundColor: colorOf(e) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white ${importanceClass(e)}`}
                >
                  <span className="shrink-0 tabular-nums opacity-90">
                    {e.time.allDay ? t("entries.allDay") : e.time.startTime}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{e.title}</span>
                  {e.repetition && <Repeat aria-hidden size={12} className="shrink-0" />}
                  {e.private && <Lock aria-hidden size={12} className="shrink-0" />}
                  <ChevronDown
                    aria-hidden
                    size={16}
                    className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded && (
                  <div className="flex flex-col gap-3 bg-surface p-3">
                    {!e.href && <EntrySummary id={e.id} occurrence={e.occurrenceDate} />}
                    <Link to={entryPath(e)} className={`${BUTTON_PRIMARY} self-end`}>
                      {e.href ? t("views.open") : t("entries.edit")}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex justify-end gap-2">
          <Link to={paths.day(day)} className={BUTTON}>
            {t("views.openDay")}
          </Link>
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("entries.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
