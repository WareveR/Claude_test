import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { checklistFromTask } from "../../core/checklist";
import { templateText } from "../../core/checklist-template";
import { IMPORTANCES } from "../../core/entry-type";
import { isPlainDate } from "../../core/plain-date";
import { api } from "../api";
import { AddToChecklistSection } from "../checklists/AddToChecklist";
import { useTemplates } from "../checklists/templates";
import { useSignedIn } from "../family";
import { LinkedEntry } from "../entries/EntryPreparation";
import { RepetitionFields } from "../entries/RepetitionFields";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { paths } from "../paths";
import { useTask, type Task, type TaskDraft } from "./model";
import { readyToEdit } from "../offline/fresh";
import { BUTTON_DANGER } from "../ui/button";
import { Chip, Switch } from "../ui/Toggle";
import { TimeSelect } from "../ui/TimeSelect";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

export function TaskPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const [search] = useSearchParams();
  const location = useLocation();
  const task = useTask(isNew ? undefined : id);
  const checklistId = isNew ? search.get("checklist") : task.data?.checklistId;
  // A Checklist's items are simple and live on their Checklist's page.
  if (checklistId) return <Navigate to={`/checklists/${checklistId}`} replace />;
  if (!isNew && !readyToEdit(task)) return null;
  return <TaskForm key={isNew ? `new:${location.key}` : id} task={isNew ? undefined : task.data} />;
}

function TaskForm({ task }: { task?: Task }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const persons = usePersons();
  const date = search.get("date");
  const entry = search.get("entry");
  const given = (useLocation().state as { values?: Partial<TaskDraft> } | null)?.values;
  const [draft, setDraft] = useState<TaskDraft>(
    () =>
      task ?? {
        title: "",
        notes: "",
        dueDate: date && isPlainDate(date) ? date : null,
        dueTime: null,
        personIds: [],
        private: false,
        importance: "normal",
        repetition: null,
        checklistId: null,
        entryId: entry,
        ...given,
      },
  );
  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));
  // A Task with items is kept as a Checklist (ADR 0008): saving opens its page to add them.
  const [withItems, setWithItems] = useState(false);
  const { language } = useSignedIn();
  const templates = useTemplates();
  const [templateId, setTemplateId] = useState("");
  const template = templates.data?.find((tpl) => tpl.id === templateId);

  const leave = async () => {
    if (task) queryClient.removeQueries({ queryKey: ["task", task.id] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (window.history.length > 1) navigate(-1);
    else navigate(paths.tasks());
  };
  const save = useMutation({
    mutationFn: () =>
      task
        ? api(`/tasks/${task.id}`, { method: "PUT", body: draft })
        : api("/tasks", { method: "POST", body: draft }),
    onSuccess: leave,
  });
  const saveWithItems = useMutation({
    mutationFn: async () => {
      const items = template ? templateText(template, language).items : [];
      if (!task) {
        return api<{ id: string }>("/checklists", {
          method: "POST",
          body: { ...checklistFromTask(draft), items },
        });
      }
      const checklist = await api<{ id: string }>(`/tasks/${task.id}/with-items`, {
        method: "POST",
      });
      if (items.length > 0) {
        await api(`/checklists/${checklist.id}/items`, { method: "POST", body: { items } });
      }
      return checklist;
    },
    onSuccess: async (checklist) => {
      if (task) queryClient.removeQueries({ queryKey: ["task", task.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["checklists"] }),
      ]);
      navigate(`/checklists/${checklist.id}`, { replace: true });
    },
  });
  const saving = withItems ? saveWithItems : save;
  const remove = useMutation({
    mutationFn: () => api(`/tasks/${task!.id}`, { method: "DELETE" }),
    onSuccess: leave,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    saving.mutate();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{task ? task.title : t("tasks.new")}</h1>
      </div>
      {task?.doneAt && (
        <p className="text-sm text-muted">
          {t("tasks.doneAt", {
            when: new Date(task.doneAt).toLocaleString(i18n.language, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("tasks.title")}>
          <TextInput
            required
            autoFocus={!task}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        {draft.entryId && (
          <LinkedEntry entryId={draft.entryId} onUnlink={() => set({ entryId: null })} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={withItems} onChange={(e) => setWithItems(e.target.checked)} />
          {t("tasks.withItems")}
        </label>
        <p className="-mt-3 text-xs text-muted">
          {t(withItems ? "tasks.withItemsOnHint" : "tasks.withItemsHint")}
        </p>
        {withItems && (templates.data?.length ?? 0) > 0 && (
          <Field label={t("checklists.usePredefined")}>
            <select
              className={INPUT}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">{t("checklistTemplates.blank")}</option>
              {templates.data?.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {templateText(tpl, language).name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex gap-3">
          <Field label={t("tasks.dueDate")}>
            <TextInput
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(e) =>
                set(
                  e.target.value
                    ? { dueDate: e.target.value }
                    : { dueDate: null, dueTime: null, repetition: null },
                )
              }
            />
          </Field>
          {!withItems && (
            <Field label={t("tasks.dueTime")}>
              <TimeSelect
                optional
                label={t("tasks.dueTime")}
                disabled={!draft.dueDate}
                value={draft.dueTime ?? ""}
                onChange={(value) => set({ dueTime: value || null })}
              />
            </Field>
          )}
        </div>

        {draft.dueDate ? (
          <RepetitionFields
            value={draft.repetition}
            start={draft.dueDate}
            onChange={(repetition) => set({ repetition })}
          />
        ) : (
          <p className="text-xs text-muted">{t("tasks.repeatNeedsDate")}</p>
        )}
        {draft.repetition && <p className="-mt-2 text-xs text-muted">{t("tasks.repeatHint")}</p>}

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
          <p className="text-xs text-muted">{t("tasks.familyWideHint")}</p>
        </fieldset>

        {!withItems && (
          <>
            <Field label={t("entries.importance")}>
              <select
                className={INPUT}
                value={draft.importance}
                onChange={(e) => set({ importance: e.target.value as TaskDraft["importance"] })}
              >
                {IMPORTANCES.map((i) => (
                  <option key={i} value={i}>
                    {t(`importance.${i}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("entries.notes")}>
              <textarea
                className={INPUT}
                rows={3}
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.private}
                onChange={(e) => set({ private: e.target.checked })}
              />
              {t("entries.private")}
            </label>
            <p className="-mt-3 text-xs text-muted">{t("entries.privateHint")}</p>
          </>
        )}

        {saving.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={saving.isPending}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate(-1)}
        />
      </form>
      {task && <AddToChecklistSection task={task} />}
      {task && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className={BUTTON_DANGER}
            onClick={() => {
              if (window.confirm(t("tasks.confirmDelete", { title: task.title }))) remove.mutate();
            }}
          >
            {t("tasks.delete")}
          </button>
        </div>
      )}
    </main>
  );
}
