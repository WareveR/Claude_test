import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  clockTime,
  isClockTime,
  minutesOf,
  moveStart,
  type EntryTime,
} from "../../core/entry-time";
import { ICONS, IMPORTANCES, type EntryTypeDefaults } from "../../core/entry-type";
import { addDays, isPlainDate, todayIn } from "../../core/plain-date";
import { api, ApiError } from "../api";
import { REMINDER_CHOICES, reminderLabel, typeName, useEntryTypes } from "../entry-types/model";
import type { EntryType } from "../entry-types/model";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { Icon } from "../ui/Icon";
import { useEntry, type Entry, type EntryDraft } from "./model";
import { RepetitionFields } from "./RepetitionFields";

const INPUT =
  "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink dark:border-line";
/** The time picker suggests 15-minute steps but accepts any typed minute. */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => clockTime(i * 15));

export function EntryPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const entry = useEntry(isNew ? undefined : id);
  const types = useEntryTypes();
  if (!types.data || (!isNew && !entry.data)) return null;
  return <EntryForm key={id} entry={isNew ? undefined : entry.data} types={types.data} />;
}

/** A new Entry pre-filled from the address (date, time) and its Entry Type's defaults. */
function newDraft(type: EntryType, date: string, time: string | null): EntryDraft {
  return applyDefaults(
    {
      title: "",
      entryTypeId: type.id,
      time: {
        allDay: false,
        startDate: date,
        startTime: time ?? "09:00",
        endDate: null,
        endTime: null,
      },
      personIds: [],
      importance: "normal",
      location: "",
      notes: "",
      icon: null,
      private: false,
      reminders: [],
      repetition: null,
    },
    type.defaults,
    time !== null,
  );
}

function applyDefaults(draft: EntryDraft, d: EntryTypeDefaults, keepTime: boolean): EntryDraft {
  const start = draft.time.startDate;
  let time: EntryTime;
  if (d.allDay) {
    time = { allDay: true, startDate: start, endDate: start };
  } else {
    const startTime =
      keepTime && !draft.time.allDay ? draft.time.startTime : (d.startTime ?? "09:00");
    const end = d.durationMinutes ? minutesOf(startTime) + d.durationMinutes : null;
    time = {
      allDay: false,
      startDate: start,
      startTime,
      endDate: end === null ? null : end >= 1440 ? addDays(start, 1) : start,
      endTime: end === null ? null : clockTime(end % 1440),
    };
  }
  return {
    ...draft,
    time,
    importance: d.importance ?? "normal",
    location: d.location ?? "",
    notes: d.notes ?? "",
    personIds: d.personIds ?? [],
    reminders: d.reminders ?? [],
    repetition: d.repetition ?? null,
  };
}

function EntryForm({ entry, types }: { entry?: Entry; types: EntryType[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const { family } = useSignedIn();
  const persons = usePersons();
  const general = types.find((ty) => ty.builtinKey === "general") ?? types[0];
  const startDate = search.get("date");
  const startTime = search.get("time");
  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (entry) return entry;
    const type = types.find((ty) => ty.id === search.get("type")) ?? general;
    return newDraft(
      type,
      startDate && isPlainDate(startDate) ? startDate : todayIn(family.timeZone),
      startTime && isClockTime(startTime) ? startTime : null,
    );
  });
  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setTime = (patch: Partial<EntryTime>) =>
    setDraft((d) => ({ ...d, time: { ...d.time, ...patch } as EntryTime }));

  const leave = async () => {
    if (entry) queryClient.removeQueries({ queryKey: ["entry", entry.id] });
    await queryClient.invalidateQueries({ queryKey: ["entries"] });
    if (window.history.length > 1) navigate(-1);
    else navigate(paths.day(draft.time.startDate));
  };
  const save = useMutation({
    mutationFn: () =>
      entry
        ? api(`/entries/${entry.id}`, { method: "PUT", body: draft })
        : api("/entries", { method: "POST", body: draft }),
    onSuccess: leave,
  });
  const remove = useMutation({
    mutationFn: () => api(`/entries/${entry!.id}`, { method: "DELETE" }),
    onSuccess: leave,
  });

  function changeType(typeId: string) {
    const type = types.find((ty) => ty.id === typeId)!;
    // A new Entry takes the type's defaults; an existing one keeps its values.
    if (entry) set({ entryTypeId: typeId });
    else
      setDraft(applyDefaults({ ...draft, entryTypeId: typeId }, type.defaults, Boolean(startTime)));
  }

  function toggleAllDay(allDay: boolean) {
    const date = draft.time.startDate;
    setDraft((d) => ({
      ...d,
      time: allDay
        ? { allDay: true, startDate: date, endDate: date }
        : { allDay: false, startDate: date, startTime: "09:00", endDate: null, endTime: null },
    }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const time = draft.time;
  const hasEnd = !time.allDay && time.endDate !== null;
  const reminderChoices = [...new Set([...REMINDER_CHOICES, ...draft.reminders])].sort(
    (a, b) => a - b,
  );
  const saveError = save.error instanceof ApiError ? save.error.body : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button type="button" className="text-sm underline" onClick={() => navigate(-1)}>
          {t("settings.back")}
        </button>
        <h1 className="text-xl font-semibold">{entry ? entry.title : t("entries.new")}</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("entries.title")}>
          <TextInput
            required
            autoFocus={!entry}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <Field label={t("entries.type")}>
          <select
            className={INPUT}
            value={draft.entryTypeId}
            onChange={(e) => changeType(e.target.value)}
          >
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>
                {typeName(ty, t)}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={time.allDay}
            onChange={(e) => toggleAllDay(e.target.checked)}
          />
          {t("entries.allDay")}
        </label>
        <datalist id="quarter-hours">
          {QUARTER_HOURS.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
        {time.allDay ? (
          <div className="flex gap-3">
            <Field label={t("entries.from")}>
              <TextInput
                type="date"
                required
                value={time.startDate}
                onChange={(e) => e.target.value && set({ time: moveStart(time, e.target.value) })}
              />
            </Field>
            <Field label={t("entries.to")}>
              <TextInput
                type="date"
                required
                min={time.startDate}
                value={time.endDate}
                onChange={(e) => setTime({ endDate: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <Field label={t("entries.startDate")}>
                <TextInput
                  type="date"
                  required
                  value={time.startDate}
                  onChange={(e) => e.target.value && set({ time: moveStart(time, e.target.value) })}
                />
              </Field>
              <Field label={t("entries.startTime")}>
                <TextInput
                  required
                  list="quarter-hours"
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  placeholder="09:00"
                  value={time.startTime}
                  onChange={(e) =>
                    isClockTime(e.target.value)
                      ? set({ time: moveStart(time, time.startDate, e.target.value) })
                      : setTime({ startTime: e.target.value })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasEnd}
                onChange={(e) =>
                  setTime(
                    e.target.checked
                      ? {
                          endDate: time.startDate,
                          endTime: clockTime(Math.min(minutesOf(time.startTime) + 60, 1439)),
                        }
                      : { endDate: null, endTime: null },
                  )
                }
              />
              {t("entries.hasEnd")}
            </label>
            {hasEnd && (
              <div className="flex gap-3">
                <Field label={t("entries.endDate")}>
                  <TextInput
                    type="date"
                    required
                    min={time.startDate}
                    value={time.endDate ?? ""}
                    onChange={(e) => setTime({ endDate: e.target.value })}
                  />
                </Field>
                <Field label={t("entries.endTime")}>
                  <TextInput
                    required
                    list="quarter-hours"
                    pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                    value={time.endTime ?? ""}
                    onChange={(e) => setTime({ endTime: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        <RepetitionFields
          value={draft.repetition}
          start={draft.time.startDate}
          onChange={(repetition) => set({ repetition })}
        />

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entries.persons")}</legend>
          <div className="flex flex-wrap gap-3">
            {persons.data
              ?.filter((p) => !p.archived || draft.personIds.includes(p.id))
              .map((p) => (
                <label key={p.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={draft.personIds.includes(p.id)}
                    onChange={(e) =>
                      set({
                        personIds: e.target.checked
                          ? [...draft.personIds, p.id]
                          : draft.personIds.filter((id) => id !== p.id),
                      })
                    }
                  />
                  <PersonAvatar person={p} size={24} />
                  {p.name}
                </label>
              ))}
          </div>
          <p className="text-xs text-muted">{t("entries.familyWideHint")}</p>
        </fieldset>

        <Field label={t("entries.importance")}>
          <select
            className={INPUT}
            value={draft.importance}
            onChange={(e) => set({ importance: e.target.value as EntryDraft["importance"] })}
          >
            {IMPORTANCES.map((i) => (
              <option key={i} value={i}>
                {t(`importance.${i}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("entries.location")}>
          <TextInput value={draft.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label={t("entries.notes")}>
          <textarea
            className={INPUT}
            rows={3}
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entries.icon")}</legend>
          <div className="flex flex-wrap gap-1">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="icon"
                checked={draft.icon === null}
                onChange={() => set({ icon: null })}
                className="peer sr-only"
              />
              <span className="flex h-9 items-center rounded-md px-2 text-xs peer-checked:bg-ink peer-checked:text-bg">
                {t("entries.typeIcon")}
              </span>
            </label>
            {ICONS.map((key) => (
              <label key={key} className="cursor-pointer">
                <input
                  type="radio"
                  name="icon"
                  checked={draft.icon === key}
                  onChange={() => set({ icon: key })}
                  className="peer sr-only"
                  aria-label={key}
                />
                <span className="flex size-9 items-center justify-center rounded-md peer-checked:bg-ink peer-checked:text-bg">
                  <Icon name={key} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entries.reminders")}</legend>
          <div className="flex flex-wrap gap-3">
            {reminderChoices.map((minutes) => (
              <label key={minutes} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.reminders.includes(minutes)}
                  onChange={(e) =>
                    set({
                      reminders: e.target.checked
                        ? [...draft.reminders, minutes]
                        : draft.reminders.filter((r) => r !== minutes),
                    })
                  }
                />
                {reminderLabel(minutes, t)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.private}
            onChange={(e) => set({ private: e.target.checked })}
          />
          {t("entries.private")}
        </label>
        <p className="-mt-3 text-xs text-muted">{t("entries.privateHint")}</p>

        {saveError && (
          <ErrorText>
            {saveError.field === "time" ? t("entries.badTime") : t("errors.unexpected")}
          </ErrorText>
        )}
        {save.error && !saveError && <ErrorText>{t("errors.network")}</ErrorText>}
        <SubmitButton busy={save.isPending}>{t("persons.save")}</SubmitButton>
      </form>
      {entry && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className="text-overdue underline"
            onClick={() => {
              if (window.confirm(t("entries.confirmDelete", { title: entry.title }))) {
                remove.mutate();
              }
            }}
          >
            {t("entries.delete")}
          </button>
        </div>
      )}
    </main>
  );
}
