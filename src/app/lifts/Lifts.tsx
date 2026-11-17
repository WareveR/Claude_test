import { AlertTriangle, CarFront } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EntryTime } from "../../core/entry-time";
import { liftClashes, liftMissing, type Busy, type LiftRole } from "../../core/lifts";
import { useOccurrences } from "../entries/model";
import { usePersons } from "../persons/model";
import { BUTTON } from "../ui/button";
import { useLifts, useRemoveLift, useSetLift } from "./model";

const SELECT = "w-full rounded-md border border-line bg-surface px-3 py-2 text-base";

/** An hour after the start when no end is given; "24:00" when it ends on a later day. */
function endOn(time: Extract<EntryTime, { allDay: false }>, date: string): string {
  if (time.endDate && time.endDate > date) return "24:00";
  if (time.endTime) return time.endTime;
  const [h, m] = time.startTime.split(":").map(Number);
  const minutes = Math.min(24 * 60, h * 60 + m + 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The mark on the calendar of an Entry whose Lift still misses someone. */
export function LiftMissingMark() {
  const { t } = useTranslation();
  return (
    <span data-testid="lift-missing" title={t("lifts.missingMark")} className="flex">
      <CarFront role="img" aria-label={t("lifts.missingMark")} size={10} strokeWidth={2.5} />
    </span>
  );
}

/**
 * On a timed Entry's details: whether it needs a Lift, who takes and who picks up, and a
 * warning when nobody does yet or when they have something else on at that moment.
 */
export function LiftBox({ entryId, time }: { entryId: string; time: EntryTime }) {
  const { t } = useTranslation();
  const lift = useLifts().get(entryId);
  const set = useSetLift();
  const remove = useRemoveLift();
  const persons = (usePersons().data ?? []).filter(
    (p) =>
      p.kind !== "animal" && (!p.archived || p.id === lift?.dropOffId || p.id === lift?.pickUpId),
  );
  const date = time.startDate;
  const day = useOccurrences(date, date).data ?? [];
  if (time.allDay) return null;
  if (!lift) {
    return (
      <button
        type="button"
        className={`${BUTTON} flex items-center gap-1.5 self-start`}
        onClick={() => set.mutate({ entryId, dropOffId: null, pickUpId: null })}
      >
        <CarFront aria-hidden size={16} />
        {t("lifts.needs")}
      </button>
    );
  }
  const others: Busy[] = day
    .filter((o) => !o.time.allDay && o.time.startDate === date)
    .map((o) => {
      const at = o.time as Extract<EntryTime, { allDay: false }>;
      return {
        id: o.id,
        title: o.hidden ? t("entries.private") : o.title,
        personIds: o.personIds,
        start: at.startTime,
        end: endOn(at, date),
      };
    });
  const clashes = liftClashes(lift, { start: time.startTime, end: endOn(time, date) }, others);
  const name = (id: string) => persons.find((p) => p.id === id)?.name ?? "";
  const picker = (role: LiftRole, value: string | null) => (
    <label className="flex flex-col gap-1 text-sm">
      {t(`lifts.${role}`)}
      <select
        className={SELECT}
        value={value ?? ""}
        onChange={(e) => set.mutate({ ...lift, [`${role}Id`]: e.target.value || null })}
      >
        <option value="">{t("lifts.nobody")}</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3" data-testid="lift">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <CarFront aria-hidden size={18} className="text-muted" />
        {t("lifts.title")}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {picker("dropOff", lift.dropOffId)}
        {picker("pickUp", lift.pickUpId)}
      </div>
      {[
        ...liftMissing(lift).map((role) => t(`lifts.missing.${role}`)),
        ...clashes.map((c) =>
          t(`lifts.busy.${c.role}`, { name: name(c.personId), title: c.title }),
        ),
      ].map((text) => (
        <p key={text} className="flex items-start gap-1.5 text-sm text-overdue">
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0" />
          {text}
        </p>
      ))}
      <button
        type="button"
        className={`${BUTTON} self-start text-xs`}
        onClick={() => remove.mutate(entryId)}
      >
        {t("lifts.none")}
      </button>
    </section>
  );
}
