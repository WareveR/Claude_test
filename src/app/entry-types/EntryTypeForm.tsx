import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { ICONS, IMPORTANCES, type EntryTypeDefaults } from "../../core/entry-type";
import type { Repetition } from "../../core/repetition";
import { api } from "../api";
import type { Entry } from "../entries/model";
import { PERSON_COLORS, uploadPhoto, usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { Icon } from "../ui/Icon";
import { EntryTypeBadge } from "./EntryTypeBadge";
import { REMINDER_CHOICES, reminderLabel, typeName, useEntryTypes, type EntryType } from "./model";
import { readyToEdit } from "../offline/fresh";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { TimeSelect } from "../ui/TimeSelect";

const FREQUENCIES = ["none", "daily", "weekly", "monthly", "yearly"] as const;
const SELECT = "rounded-md border border-line bg-surface px-3 py-2";

export function EntryTypePage() {
  const { id } = useParams();
  const types = useEntryTypes();
  if (id !== "new" && !readyToEdit(types)) return null;
  return <EntryTypeForm key={id} type={types.data?.find((t) => t.id === id)} />;
}

function EntryTypeForm({ type }: { type?: EntryType }) {
  const types = useEntryTypes();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const [name, setName] = useState(type ? typeName(type, t) : "");
  const [color, setColor] = useState(type?.color ?? PERSON_COLORS[5]);
  const [icon, setIcon] = useState(type?.icon ?? "calendar");
  const [thumbnailKey, setThumbnailKey] = useState(type?.thumbnailKey ?? null);
  const [defaults, setDefaults] = useState<EntryTypeDefaults>(type?.defaults ?? {});
  const set = (patch: Partial<EntryTypeDefaults>) => setDefaults((d) => ({ ...d, ...patch }));

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["entry-types"] });
    navigate("/settings/family");
  };
  const save = useMutation({
    mutationFn: () => {
      // A built-in type keeps translating until its name actually changes.
      const renamed = !type?.builtinKey || name !== typeName(type, t);
      const body = {
        ...(renamed ? { name } : {}),
        color,
        icon,
        thumbnailKey,
        defaults,
      };
      return type
        ? api(`/entry-types/${type.id}`, { method: "PATCH", body })
        : api("/entry-types", { method: "POST", body });
    },
    onSuccess: done,
  });
  const [deleting, setDeleting] = useState(false);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const typeEntries = useQuery({
    queryKey: ["entries", "type", type?.id],
    queryFn: () => api<Entry[]>(`/entries?entryTypeId=${type!.id}`),
    enabled: deleting,
  });
  const remove = useMutation({
    mutationFn: () => api(`/entry-types/${type!.id}`, { method: "DELETE", body: { moves } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["entries"] });
      await done();
    },
  });
  const otherTypes = (types.data ?? []).filter((other) => other.id !== type?.id);
  const general = otherTypes.find((other) => other.builtinKey === "general");

  const repetition = defaults.repetition;
  function setFrequency(frequency: (typeof FREQUENCIES)[number]) {
    set({
      repetition:
        frequency === "none"
          ? null
          : ({ frequency, interval: 1, end: { type: "never" } } satisfies Repetition),
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{type ? typeName(type, t) : t("entryTypes.add")}</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("entryTypes.name")}>
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entryTypes.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {PERSON_COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="peer sr-only"
                  aria-label={c}
                />
                <span
                  style={{ backgroundColor: c }}
                  className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-accent"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entryTypes.icon")}</legend>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((key) => (
              <label key={key} className="cursor-pointer">
                <input
                  type="radio"
                  name="icon"
                  checked={icon === key && !thumbnailKey}
                  onChange={() => {
                    setIcon(key);
                    setThumbnailKey(null);
                  }}
                  className="peer sr-only"
                  aria-label={key}
                />
                <span className="flex size-9 items-center justify-center rounded-md peer-checked:bg-accent peer-checked:text-accent-ink">
                  <Icon name={key} />
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <EntryTypeBadge type={{ color, icon, thumbnailKey }} size={40} />
            <label className={BUTTON}>
              {t("entryTypes.thumbnail")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setThumbnailKey(await uploadPhoto(file));
                }}
              />
            </label>
          </div>
        </fieldset>

        <h2 className="mt-2 font-semibold">{t("entryTypes.defaults")}</h2>
        <p className="-mt-3 text-xs text-muted">{t("entryTypes.defaultsHint")}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={defaults.allDay ?? false}
            onChange={(e) => set({ allDay: e.target.checked })}
          />
          {t("entryTypes.allDay")}
        </label>
        {!defaults.allDay && (
          <div className="flex gap-3">
            <Field label={t("entryTypes.startTime")}>
              <TimeSelect
                optional
                value={defaults.startTime ?? ""}
                onChange={(e) => set({ startTime: e.target.value || undefined })}
              />
            </Field>
            <Field label={t("entryTypes.duration")}>
              <TextInput
                type="number"
                min={0}
                step={15}
                value={defaults.durationMinutes ?? ""}
                onChange={(e) =>
                  set({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </Field>
          </div>
        )}
        <Field label={t("entryTypes.repetition")}>
          <select
            className={SELECT}
            value={repetition?.frequency ?? "none"}
            onChange={(e) => setFrequency(e.target.value as (typeof FREQUENCIES)[number])}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(`repetition.${f}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("entryTypes.importance")}>
          <select
            className={SELECT}
            value={defaults.importance ?? "normal"}
            onChange={(e) => set({ importance: e.target.value as EntryTypeDefaults["importance"] })}
          >
            {IMPORTANCES.map((i) => (
              <option key={i} value={i}>
                {t(`importance.${i}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("entryTypes.location")}>
          <TextInput
            value={defaults.location ?? ""}
            onChange={(e) => set({ location: e.target.value })}
          />
        </Field>
        <Field label={t("entryTypes.notes")}>
          <textarea
            className={SELECT}
            rows={2}
            value={defaults.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entryTypes.persons")}</legend>
          <div className="flex flex-wrap gap-3">
            {persons.data
              ?.filter((p) => !p.archived)
              .map((p) => (
                <label key={p.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={defaults.personIds?.includes(p.id) ?? false}
                    onChange={(e) =>
                      set({
                        personIds: e.target.checked
                          ? [...(defaults.personIds ?? []), p.id]
                          : defaults.personIds?.filter((id) => id !== p.id),
                      })
                    }
                  />
                  <PersonAvatar person={p} size={24} />
                  {p.name}
                </label>
              ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("entryTypes.reminders")}</legend>
          <div className="flex flex-wrap gap-3">
            {REMINDER_CHOICES.map((minutes) => (
              <label key={minutes} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={defaults.reminders?.includes(minutes) ?? false}
                  onChange={(e) =>
                    set({
                      reminders: e.target.checked
                        ? [...(defaults.reminders ?? []), minutes]
                        : defaults.reminders?.filter((r) => r !== minutes),
                    })
                  }
                />
                {reminderLabel(minutes, t)}
              </label>
            ))}
          </div>
        </fieldset>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate("/settings/family")}
        />
      </form>
      {type?.deletable && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {!deleting ? (
            <button
              type="button"
              className={`${BUTTON_DANGER} self-start`}
              onClick={() => setDeleting(true)}
            >
              {t("entryTypes.delete")}
            </button>
          ) : (
            <>
              <p className="text-sm">
                {typeEntries.data?.length
                  ? t("entryTypes.moveEntries", { name: typeName(type, t) })
                  : t("entryTypes.noEntries")}
              </p>
              <ul className="flex flex-col gap-2">
                {typeEntries.data?.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {e.title} · {e.time.startDate}
                    </span>
                    <select
                      aria-label={t("entryTypes.moveTo", { title: e.title })}
                      className={SELECT}
                      value={moves[e.id] ?? general?.id}
                      onChange={(ev) => setMoves({ ...moves, [e.id]: ev.target.value })}
                    >
                      {otherTypes.map((other) => (
                        <option key={other.id} value={other.id}>
                          {typeName(other, t)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="self-start rounded-md bg-overdue px-4 py-2 font-medium text-accent-ink"
                onClick={() => remove.mutate()}
              >
                {t("entryTypes.confirmDeleteButton", { name: typeName(type, t) })}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
