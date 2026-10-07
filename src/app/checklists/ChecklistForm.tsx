import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import { api } from "../api";
import { useSignedIn } from "../family";
import { RepetitionFields } from "../entries/RepetitionFields";
import { paths } from "../paths";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { useChecklist, type Checklist, type ChecklistDraft } from "./model";
import { readyToEdit } from "../offline/fresh";
import { BUTTON, BUTTON_DANGER } from "../ui/button";

/** A Checklist's settings: at /checklists/new, or behind Edit on its detail page. */
export function ChecklistPage() {
  const { id } = useParams();
  const isNew = !id;
  const checklist = useChecklist(isNew ? undefined : id);
  if (!isNew && !readyToEdit(checklist)) return null;
  return <ChecklistForm key={id} checklist={isNew ? undefined : checklist.data} />;
}

/**
 * A Checklist's name, optional start and end (each on its own), Repetition, Reminder and default
 * Persons for its new items; also Use again, its previous rounds and deleting it.
 */
function ChecklistForm({ checklist }: { checklist?: Checklist }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const [draft, setDraft] = useState<ChecklistDraft>(
    () =>
      checklist ?? {
        name: "",
        startDate: null,
        endDate: null,
        repetition: null,
        remindAtStart: true,
        personIds: [],
      },
  );
  const set = (patch: Partial<ChecklistDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const today = familyNow(useSignedIn().family.timeZone).today;
  const locale = formatLocale(useSignedIn().language);
  const refresh = async () => {
    if (checklist) queryClient.removeQueries({ queryKey: ["checklist", checklist.id] });
    await queryClient.invalidateQueries({ queryKey: ["checklists"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };
  /** Back to the Checklist's own page: a step back when Edit came from there, else in place. */
  const open = async (id: string) => {
    await refresh();
    const cameFromIt = checklist && (window.history.state?.idx ?? 0) > 0;
    if (cameFromIt) navigate(-1);
    else navigate(`/checklists/${id}`, { replace: true });
  };
  const save = useMutation({
    mutationFn: () =>
      checklist
        ? api<Checklist>(`/checklists/${checklist.id}`, { method: "PUT", body: draft })
        : api<Checklist>("/checklists", { method: "POST", body: draft }),
    onSuccess: (saved) => open(saved.id),
  });
  const [newStart, setNewStart] = useState("");
  const again = useMutation({
    mutationFn: () =>
      api(`/checklists/${checklist!.id}/rounds`, {
        method: "POST",
        body: { startDate: newStart || null },
      }),
    onSuccess: () => open(checklist!.id),
  });
  const remove = useMutation({
    mutationFn: () => api(`/checklists/${checklist!.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
      navigate(paths.tasks(), { replace: true });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">
          {checklist ? checklist.name : t("checklists.new")}
        </h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("checklists.name")}>
          <TextInput
            required
            autoFocus={!checklist}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label={t("checklists.start")}>
            <TextInput
              type="date"
              value={draft.startDate ?? ""}
              max={draft.endDate ?? undefined}
              onChange={(e) => set({ startDate: e.target.value || null })}
            />
          </Field>
          <Field label={t("checklists.end")}>
            <TextInput
              type="date"
              min={draft.startDate ?? undefined}
              value={draft.endDate ?? ""}
              onChange={(e) => set({ endDate: e.target.value || null })}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">{t("checklists.periodHint")}</p>
        <RepetitionFields
          value={draft.repetition}
          start={draft.startDate ?? today}
          onChange={(repetition) => set({ repetition })}
        />
        {draft.repetition && (
          <p className="-mt-2 text-xs text-muted">
            {t("checklists.repeatHint", {
              date: formatPlainDate(draft.startDate ?? today, locale, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
            })}
          </p>
        )}
        {(draft.startDate || draft.repetition) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.remindAtStart}
              onChange={(e) => set({ remindAtStart: e.target.checked })}
            />
            {t("checklists.remindAtStart")}
          </label>
        )}

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("checklists.persons")}</legend>
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
          <p className="text-xs text-muted">{t("checklists.personsHint")}</p>
        </fieldset>

        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate(-1)}
        />
      </form>
      {checklist && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <h2 className="font-medium">{t("checklists.useAgain")}</h2>
          <p className="text-xs text-muted">{t("checklists.useAgainHint")}</p>
          {checklist.startDate && (
            <Field label={t("checklists.newStart")}>
              <TextInput
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </Field>
          )}
          <button
            type="button"
            className={`${BUTTON} self-start`}
            disabled={again.isPending}
            onClick={() => again.mutate()}
          >
            {t("checklists.useAgain")}
          </button>
          {again.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
          {checklist.rounds.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <h3 className="font-medium">{t("checklists.previousRounds")}</h3>
              <ul>
                {checklist.rounds.map((r, i) => (
                  <li key={i}>
                    {t("checklists.roundResult", { label: r.label, done: r.done, total: r.total })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {checklist && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className={BUTTON_DANGER}
            onClick={() => {
              if (window.confirm(t("checklists.confirmDelete", { name: checklist.name })))
                remove.mutate();
            }}
          >
            {t("checklists.delete")}
          </button>
        </div>
      )}
    </main>
  );
}
