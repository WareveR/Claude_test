import { Check, Pill, Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ClockTime } from "../../core/entry-time";
import { dosesOn, MAX_TIMES, type DueDose } from "../../core/medication";
import { formatPlainDate, todayIn } from "../../core/plain-date";
import { ApiError } from "../api";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, TextInput } from "../screens/form";
import { useNow } from "../shell/useNow";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import {
  useDeleteMedication,
  useDoses,
  useMedications,
  useSaveMedication,
  useTakeDose,
  type Medication,
} from "./model";

function useToday() {
  const { family } = useSignedIn();
  return todayIn(family.timeZone, useNow(60_000));
}

/** Today's doses, each with a "Taken" button that also takes the tick back. */
function DoseList({
  due,
  date,
  withPerson,
}: {
  due: DueDose[];
  date: string;
  withPerson: boolean;
}) {
  const { t } = useTranslation();
  const taken = useDoses(date).data ?? [];
  const persons = usePersons().data ?? [];
  const take = useTakeDose();
  return (
    <ul className="divide-y divide-line" data-testid="doses">
      {due.map(({ medication, time }) => {
        const done = taken.some((d) => d.medicationId === medication.id && d.time === time);
        const person = persons.find((p) => p.id === medication.personId);
        return (
          <li key={`${medication.id}-${time}`} className="flex items-center gap-2 py-2">
            <span className="w-12 shrink-0 font-semibold tabular-nums">{time}</span>
            {withPerson && person && <PersonAvatar person={person} size={20} />}
            <span className={`min-w-0 flex-1 truncate ${done ? "text-muted line-through" : ""}`}>
              {medication.name}
              {medication.dose && <span className="text-muted"> · {medication.dose}</span>}
            </span>
            <button
              type="button"
              aria-pressed={done}
              aria-label={t("medications.takenFor", { name: medication.name, time })}
              className={`${done ? BUTTON_PRIMARY : BUTTON} text-xs`}
              disabled={take.isPending}
              onClick={() => take.mutate({ medicationId: medication.id, date, time, taken: !done })}
            >
              {done && <Check aria-hidden size={14} className="mr-1 inline" />}
              {t("medications.taken")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The Summary's "Medication today": every dose due today this Account sees. */
export function TodayDoses() {
  const { t } = useTranslation();
  const today = useToday();
  const due = dosesOn(useMedications().data ?? [], today);
  if (due.length === 0) return null;
  return (
    <section
      aria-labelledby="today-doses-title"
      data-testid="today-doses"
      className="mx-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2 id="today-doses-title" className="flex items-center gap-2 text-xl font-bold">
        <Pill aria-hidden size={20} />
        {t("medications.today")}
      </h2>
      <DoseList due={due} date={today} withPerson />
    </section>
  );
}

/** On a Person's page: their Medications, today's doses and adding one. */
export function PersonMedications({ personId }: { personId: string }) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const meds = (useMedications().data ?? []).filter((m) => m.personId === personId);
  const [editing, setEditing] = useState<Medication | "new" | null>(null);
  const due = dosesOn(meds, today);
  return (
    <section
      className="flex flex-col gap-2 border-t border-line pt-4"
      data-testid="person-medications"
    >
      <h2 className="font-semibold">{t("medications.title")}</h2>
      {due.length > 0 && <DoseList due={due} date={today} withPerson={false} />}
      <ul className="divide-y divide-line">
        {meds.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="flex w-full flex-col items-start py-2 text-left"
              onClick={() => setEditing(m)}
            >
              <span>
                {m.name}
                {m.dose && <span className="text-muted"> · {m.dose}</span>}
                {m.private && <span className="text-muted"> · {t("medications.private")}</span>}
              </span>
              <span className="text-sm text-muted">
                {m.times.join(", ")}
                {m.endDate &&
                  ` · ${t("medications.until", { date: formatPlainDate(m.endDate, i18n.language, { day: "numeric", month: "short" }) })}`}
                {m.endDate && m.endDate < today && ` · ${t("medications.ended")}`}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2"
            onClick={() => setEditing("new")}
          >
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("medications.add")}
          </button>
        </li>
      </ul>
      {editing && (
        <MedicationDialog
          personId={personId}
          medication={editing === "new" ? undefined : editing}
          today={today}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function MedicationDialog({
  personId,
  medication,
  today,
  onClose,
}: {
  personId: string;
  medication?: Medication;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const save = useSaveMedication();
  const remove = useDeleteMedication();
  const [form, setForm] = useState({
    name: medication?.name ?? "",
    dose: medication?.dose ?? "",
    times: medication?.times ?? (["08:00"] as ClockTime[]),
    startDate: medication?.startDate ?? today,
    endDate: medication?.endDate ?? "",
    private: medication?.private ?? true,
    notes: medication?.notes ?? "",
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const bad = save.error instanceof ApiError ? save.error.body.field : undefined;
  const setTime = (i: number, value: string) =>
    setForm({ ...form, times: form.times.map((x, j) => (j === i ? (value as ClockTime) : x)) });
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            {
              id: medication?.id,
              personId,
              ...form,
              times: form.times.filter(Boolean),
              endDate: form.endDate || null,
            },
            { onSuccess: onClose },
          );
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {medication ? medication.name : t("medications.add")}
        </h2>
        <Field label={t("medications.name")}>
          <TextInput
            required
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("medications.dose")}>
          <TextInput
            value={form.dose}
            maxLength={100}
            placeholder={t("medications.doseHint")}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("medications.times")}</legend>
          {form.times.map((time, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                type="time"
                required
                aria-label={t("medications.timeN", { n: i + 1 })}
                value={time}
                onChange={(e) => setTime(i, e.target.value)}
              />
              {form.times.length > 1 && (
                <button
                  type="button"
                  aria-label={t("medications.removeTime", { time })}
                  className={BUTTON}
                  onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== i) })}
                >
                  <X aria-hidden size={16} />
                </button>
              )}
            </div>
          ))}
          {form.times.length < MAX_TIMES && (
            <button
              type="button"
              className={`${BUTTON} self-start`}
              onClick={() => setForm({ ...form, times: [...form.times, "20:00"] })}
            >
              {t("medications.addTime")}
            </button>
          )}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("medications.start")}>
            <TextInput
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label={t("medications.end")}>
            <TextInput
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.private}
            onChange={(e) => setForm({ ...form, private: e.target.checked })}
          />
          <span>
            {t("medications.private")}
            <span className="block text-sm text-muted">{t("medications.privateHint")}</span>
          </span>
        </label>
        <Field label={t("medications.notes")}>
          <textarea
            rows={2}
            value={form.notes}
            maxLength={1000}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
        </Field>
        {save.error && (
          <ErrorText>
            {bad ? t(`medications.bad.${bad}`, t("errors.unexpected")) : t("errors.unexpected")}
          </ErrorText>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {medication && (
            <button
              type="button"
              className={`${BUTTON_DANGER} mr-auto`}
              onClick={() => remove.mutate(medication.id, { onSuccess: onClose })}
            >
              {t("medications.delete")}
            </button>
          )}
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
            {t("medications.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
