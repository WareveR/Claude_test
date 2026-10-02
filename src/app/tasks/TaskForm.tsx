import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { isPlainDate } from "../../core/plain-date";
import { api } from "../api";
import { RepetitionFields } from "../entries/RepetitionFields";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { paths } from "../paths";
import { useTask, type Task, type TaskDraft } from "./model";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

export function TaskPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const task = useTask(isNew ? undefined : id);
  if (!isNew && !task.data) return null;
  return <TaskForm key={id} task={isNew ? undefined : task.data} />;
}

function TaskForm({ task }: { task?: Task }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const persons = usePersons();
  const date = search.get("date");
  const [draft, setDraft] = useState<TaskDraft>(
    () =>
      task ?? {
        title: "",
        notes: "",
        dueDate: date && isPlainDate(date) ? date : null,
        dueTime: null,
        personIds: [],
        private: false,
        repetition: null,
      },
  );
  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

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
  const remove = useMutation({
    mutationFn: () => api(`/tasks/${task!.id}`, { method: "DELETE" }),
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
          <Field label={t("tasks.dueTime")}>
            <TextInput
              type="time"
              disabled={!draft.dueDate}
              value={draft.dueTime ?? ""}
              onChange={(e) => set({ dueTime: e.target.value || null })}
            />
          </Field>
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
          <p className="text-xs text-muted">{t("tasks.familyWideHint")}</p>
        </fieldset>

        <Field label={t("entries.notes")}>
          <textarea
            className={INPUT}
            rows={3}
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.private}
            onChange={(e) => set({ private: e.target.checked })}
          />
          {t("entries.private")}
        </label>
        <p className="-mt-3 text-xs text-muted">{t("entries.privateHint")}</p>

        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <SubmitButton busy={save.isPending}>{t("persons.save")}</SubmitButton>
      </form>
      {task && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className="text-overdue underline"
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
