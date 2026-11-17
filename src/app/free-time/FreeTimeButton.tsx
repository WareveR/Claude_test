import { CalendarSearch } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { clockOf, freeSlots } from "../../core/free-time";
import { formatLocale } from "../../core/languages";
import { formatPlainDate, minutesNowIn, todayIn, type PlainDate } from "../../core/plain-date";
import { useOccurrences } from "../entries/model";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { BUTTON } from "../ui/button";

const LENGTHS = [30, 60, 120, 180];
/** A day lists at most this many stretches; the rest are rarely what anyone wants. */
const PER_DAY = 4;

/** The week view's button that finds when the chosen Persons are all free. */
export function FreeTimeButton({ from, to }: { from: PlainDate; to: PlainDate }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t("freeTime.title")}
        title={t("freeTime.title")}
        data-testid="free-time"
        className="rounded-md p-1.5 hover:bg-surface"
        onClick={() => setOpen(true)}
      >
        <CalendarSearch aria-hidden size={20} strokeWidth={1.75} />
      </button>
      {open && <FreeTimeDialog from={from} to={to} onClose={() => setOpen(false)} />}
    </>
  );
}

function FreeTimeDialog({
  from,
  to,
  onClose,
}: {
  from: PlainDate;
  to: PlainDate;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const navigate = useNavigate();
  const titleId = useId();
  const persons = (usePersons().data ?? []).filter((p) => !p.archived);
  const filter = usePersonFilter();
  // The Persons the views are narrowed to, or everyone.
  const [chosen, setChosen] = useState<string[]>(() =>
    filter.personIds.length > 0 ? filter.personIds : persons.map((p) => p.id),
  );
  const [minutes, setMinutes] = useState(60);
  const occurrences = useOccurrences(from, to).data;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const slots = useMemo(
    () =>
      occurrences
        ? freeSlots({
            busy: occurrences,
            personIds: chosen,
            from,
            to,
            sleep: family.sleepHours,
            minutes,
            today: todayIn(family.timeZone),
            nowMinutes: minutesNowIn(family.timeZone),
          })
        : [],
    [occurrences, chosen, from, to, family, minutes],
  );
  const days = [...new Set(slots.map((s) => s.date))];
  const toggle = (id: string) =>
    setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);
  const plan = (date: PlainDate, start: number) =>
    navigate("/entries/new", {
      state: {
        values: {
          personIds: chosen,
          time: {
            allDay: false,
            startDate: date,
            startTime: clockOf(start),
            endDate: null,
            endTime: start + minutes < 24 * 60 ? clockOf(start + minutes) : null,
          },
        },
      },
    });
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="free-time-dialog"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t("freeTime.title")}
        </h2>
        <div role="group" aria-label={t("freeTime.who")} className="flex flex-wrap gap-2">
          {persons.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={chosen.includes(p.id)}
              onClick={() => toggle(p.id)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm ${
                chosen.includes(p.id) ? "border-accent bg-accent/15" : "border-line opacity-60"
              }`}
            >
              <PersonAvatar person={p} size={24} />
              {p.name}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("freeTime.length")} className="flex flex-wrap gap-2">
          {LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === minutes}
              onClick={() => setMinutes(m)}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                m === minutes ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {m < 60
                ? t("freeTime.minutes", { count: m })
                : t("freeTime.hours", { count: m / 60 })}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t("freeTime.hint")}</p>
        {occurrences && days.length === 0 && <p>{t("freeTime.none")}</p>}
        <ul className="flex flex-col gap-2" data-testid="free-slots">
          {days.map((day) => (
            <li key={day}>
              <p className="text-sm font-medium first-letter:uppercase">
                {formatPlainDate(day, locale, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {slots
                  .filter((s) => s.date === day)
                  .slice(0, PER_DAY)
                  .map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      className={BUTTON}
                      title={t("freeTime.plan")}
                      onClick={() => plan(day, s.start)}
                    >
                      {clockOf(s.start)}–{clockOf(s.end)}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("freeTime.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
