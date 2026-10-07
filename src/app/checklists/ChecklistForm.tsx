import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { api } from "../api";
import { RepetitionFields } from "../entries/RepetitionFields";
import { paths } from "../paths";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { useChecklist, type Checklist, type ChecklistDraft } from "./model";
import { readyToEdit } from "../offline/fresh";
import { BUTTON, BUTTON_DANGER } from "../ui/button";

export function ChecklistPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const checklist = useChecklist(isNew ? undefined : id);
  if (!isNew && !readyToEdit(checklist)) return null;
  return <ChecklistForm key={id} checklist={isNew ? undefined : checklist.data} />;
}

/** A Checklist's name, optional period and default Persons for its new Tasks. */
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
  const leave = async () => {
    if (checklist) queryClient.removeQueries({ queryKey: ["checklist", checklist.id] });
    await queryClient.invalidateQueries({ queryKey: ["checklists"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    navigate(paths.tasks());
  };
  const save = useMutation({
    mutationFn: () =>
      checklist
        ? api(`/checklists/${checklist.id}`, { method: "PUT", body: draft })
        : api("/checklists", { method: "POST", body: draft }),
    onSuccess: leave,
  });
  const [newStart, setNewStart] = useState("");
  const again = useMutation({
    mutationFn: () =>
      api(`/checklists/${checklist!.id}/rounds`, {
        method: "POST",
        body: { startDate: newStart || null },
      }),
    onSuccess: leave,
  });
  const remove = useMutation({
    mutationFn: () => api(`/checklists/${checklist!.id}`, { method: "DELETE" }),
    onSuccess: leave,
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
              onChange={(e) =>
                set({
                  startDate: e.target.value || null,
                  ...(e.target.value ? {} : { repetition: null }),
                })
              }
            />
          </Field>
          <Field label={t("checklists.end")}>
            <TextInput
              type="date"
              required={Boolean(draft.startDate)}
              min={draft.startDate ?? undefined}
              value={draft.endDate ?? ""}
              onChange={(e) => set({ endDate: e.target.value || null })}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">{t("checklists.periodHint")}</p>
        {draft.startDate && (
          <>
            <RepetitionFields
              value={draft.repetition}
              start={draft.startDate}
              onChange={(repetition) => set({ repetition })}
            />
            {draft.repetition && (
              <p className="-mt-2 text-xs text-muted">{t("checklists.repeatHint")}</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.remindAtStart}
                onChange={(e) => set({ remindAtStart: e.target.checked })}
              />
              {t("checklists.remindAtStart")}
            </label>
          </>
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
