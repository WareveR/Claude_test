import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
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
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { Icon } from "../ui/Icon";
import { occurrenceValues, useEntry, type Entry, type EntryDraft } from "./model";
import { ScopeDialog, type Scope } from "./ScopeDialog";
import { RepetitionFields } from "./RepetitionFields";
import { readyToEdit } from "../offline/fresh";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { Chip, Switch } from "../ui/Toggle";
import { TimeSelect } from "../ui/TimeSelect";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";
/** The time picker suggests 15-minute steps but accepts any typed minute. */

export function EntryPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const location = useLocation();
  const isNew = id === "new";
  const entry = useEntry(isNew ? undefined : id);
  const types = useEntryTypes();
  if (!types.data || (!isNew && !readyToEdit(entry))) return null;
  const date = search.get("occurrence");
  const occurrence =
    // A synced Birthday's edits always apply to every year.
    entry.data?.repetition && !entry.data.birthdayPersonId && date && isPlainDate(date)
      ? { date, values: occurrenceValues(entry.data, date) }
      : null;
  return (
    <EntryForm
      key={`${id}:${date}:${isNew ? location.key : ""}`}
      entry={isNew ? undefined : entry.data}
      occurrence={occurrence?.values ? { date: occurrence.date, values: occurrence.values } : null}
      types={types.data}
    />
  );
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
      birthYearKnown: false,
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

function EntryForm({
  entry,
  occurrence,
  types,
}: {
  entry?: Entry;
  /** The Occurrence of a repeating Entry the form was opened from. */
  occurrence: { date: string; values: Entry } | null;
  types: EntryType[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const { family } = useSignedIn();
  const persons = usePersons();
  const general = types.find((ty) => ty.builtinKey === "general") ?? types[0];
  const synced = entry?.birthdayPersonId ?? null;
  const syncedPerson = persons.data?.find((p) => p.id === synced);
  const startDate = search.get("date");
  const startTime = search.get("time");
  const given = (useLocation().state as { values?: Partial<EntryDraft> } | null)?.values;
  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (occurrence) return occurrence.values;
    if (entry) return entry;
    const type = types.find((ty) => ty.id === search.get("type")) ?? general;
    const fresh = newDraft(
      type,
      startDate && isPlainDate(startDate) ? startDate : todayIn(family.timeZone),
      startTime && isClockTime(startTime) ? startTime : null,
    );
    // Values from a Voice Entry already include the Entry Type's defaults.
    return given ? { ...fresh, ...given } : fresh;
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
  const [asking, setAsking] = useState<"save" | "delete" | null>(null);
  const repetitionChanged =
    JSON.stringify(draft.repetition) !== JSON.stringify(entry?.repetition ?? null);
  const save = useMutation({
    mutationFn: (scope: Scope | null) => {
      if (!entry) return api("/entries", { method: "POST", body: draft });
      if (!occurrence || scope === null) {
        return api(`/entries/${entry.id}`, { method: "PUT", body: draft });
      }
      const at = `/entries/${entry.id}`;
      if (scope === "this") {
        return api(`${at}/occurrences/${occurrence.date}`, {
          method: "PUT",
          body: { ...draft, repetition: null },
        });
      }
      if (scope === "following") {
        return api(`${at}/following/${occurrence.date}`, { method: "POST", body: draft });
      }
      // "All": move the series by however far this Occurrence was moved.
      const shift = dayDifference(occurrence.date, draft.time.startDate);
      const time = moveStart(draft.time, addDays(entry.time.startDate, shift));
      return api(at, { method: "PUT", body: { ...draft, time } });
    },
    onSuccess: leave,
  });
  const remove = useMutation({
    mutationFn: (scope: Scope | null) => {
      const at = `/entries/${entry!.id}`;
      if (occurrence && scope === "this") {
        return api(`${at}/occurrences/${occurrence.date}`, { method: "DELETE" });
      }
      if (occurrence && scope === "following") {
        return api(`${at}/following/${occurrence.date}`, { method: "DELETE" });
      }
      return api(at, { method: "DELETE" });
    },
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
    if (occurrence) setAsking("save");
    else save.mutate(null);
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
        <h1 className="text-xl font-semibold">{entry ? entry.title : t("entries.new")}</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {synced && (
          <p className="rounded-md bg-surface p-3 text-sm">
            {t("entries.birthdaySynced", { name: syncedPerson?.name ?? draft.title })}{" "}
            <Link className={BUTTON} to={`/settings/persons/${synced}`}>
              {t("entries.openPerson")}
            </Link>
          </p>
        )}
        {/* A synced Birthday's date, title and Person follow its Person. */}
        <fieldset disabled={Boolean(synced)} className="contents">
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
            <Switch checked={time.allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
            {t("entries.allDay")}
          </label>
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
                    onChange={(e) =>
                      e.target.value && set({ time: moveStart(time, e.target.value) })
                    }
                  />
                </Field>
                <Field label={t("entries.startTime")}>
                  <TimeSelect
                    required
                    label={t("entries.startTime")}
                    value={time.startTime}
                    onChange={(value) => set({ time: moveStart(time, time.startDate, value) })}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
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
                    <TimeSelect
                      required
                      label={t("entries.endTime")}
                      value={time.endTime ?? ""}
                      onChange={(value) => setTime({ endTime: value })}
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
                  <Chip
                    key={p.id}
                    checked={draft.personIds.includes(p.id)}
                    onChange={(e) =>
                      set({
                        personIds: e.target.checked
                          ? [...draft.personIds, p.id]
                          : draft.personIds.filter((id) => id !== p.id),
                      })
                    }
                  >
                    <PersonAvatar person={p} size={24} />
                    {p.name}
                  </Chip>
                ))}
            </div>
            <p className="text-xs text-muted">{t("entries.familyWideHint")}</p>
          </fieldset>
          {types.find((ty) => ty.id === draft.entryTypeId)?.builtinKey === "birthday" &&
            !synced && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(draft.birthYearKnown)}
                  onChange={(e) => set({ birthYearKnown: e.target.checked })}
                />
                {t("entries.birthYearKnown")}
              </label>
            )}
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
              <Chip
                key={minutes}
                checked={draft.reminders.includes(minutes)}
                onChange={(e) =>
                  set({
                    reminders: e.target.checked
                      ? [...draft.reminders, minutes]
                      : draft.reminders.filter((r) => r !== minutes),
                  })
                }
              >
                {reminderLabel(minutes, t)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={draft.private} onChange={(e) => set({ private: e.target.checked })} />
          {t("entries.private")}
        </label>
        <p className="-mt-3 text-xs text-muted">{t("entries.privateHint")}</p>

        {saveError && (
          <ErrorText>
            {saveError.error === "birthday_locked"
              ? t("entries.birthdayLocked")
              : saveError.field === "time"
                ? t("entries.badTime")
                : t("errors.unexpected")}
          </ErrorText>
        )}
        {save.error && !saveError && <ErrorText>{t("errors.network")}</ErrorText>}
        <FormActions
          busy={save.isPending}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate(-1)}
        />
      </form>
      {entry && !synced && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className={BUTTON_DANGER}
            onClick={() => {
              if (occurrence) setAsking("delete");
              else if (window.confirm(t("entries.confirmDelete", { title: entry.title }))) {
                remove.mutate(null);
              }
            }}
          >
            {t("entries.delete")}
          </button>
        </div>
      )}
      {asking && (
        <ScopeDialog
          action={asking}
          allowThis={asking === "delete" || !repetitionChanged}
          onCancel={() => setAsking(null)}
          onPick={(scope) => {
            setAsking(null);
            if (asking === "save") save.mutate(scope);
            else remove.mutate(scope);
          }}
        />
      )}
    </main>
  );
}

function dayDifference(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
