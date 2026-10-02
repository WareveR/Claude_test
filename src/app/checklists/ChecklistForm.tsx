import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { api } from "../api";
import { paths } from "../paths";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { useChecklist, type Checklist, type ChecklistDraft } from "./model";

export function ChecklistPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const checklist = useChecklist(isNew ? undefined : id);
  if (!isNew && !checklist.data) return null;
  return <ChecklistForm key={id} checklist={isNew ? undefined : checklist.data} />;
}

/** A Checklist's name, optional period and default Persons for its new Tasks. */
function ChecklistForm({ checklist }: { checklist?: Checklist }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const [draft, setDraft] = useState<ChecklistDraft>(
    () => checklist ?? { name: "", startDate: null, endDate: null, personIds: [] },
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
        <button type="button" className="text-sm underline" onClick={() => navigate(-1)}>
          {t("settings.back")}
        </button>
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
              onChange={(e) => set({ startDate: e.target.value || null })}
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
        <SubmitButton busy={save.isPending}>{t("persons.save")}</SubmitButton>
      </form>
      {checklist && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className="text-overdue underline"
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
