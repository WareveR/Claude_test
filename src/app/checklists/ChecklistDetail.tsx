import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router";
import { checklistProgress, isChecklistTaskOverdue } from "../../core/checklist";
import { familyNow } from "../../core/task";
import { api } from "../api";
import { useSignedIn } from "../family";
import { useOnline } from "../offline/online";
import { paths } from "../paths";
import { usePersons, type Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, TextInput } from "../screens/form";
import { useNow } from "../shell/useNow";
import { useTasks, useTick, type Task } from "../tasks/model";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { useChecklists, type Checklist } from "./model";
import { usePeriodText } from "./period";

/** A Checklist with every item to tick, add, rename or remove; its settings sit behind Edit. */
export function ChecklistDetailPage() {
  const { id } = useParams();
  const checklists = useChecklists();
  const tasks = useTasks();
  if (!checklists.data || !tasks.data) return null;
  const checklist = checklists.data.find((c) => c.id === id);
  if (!checklist) return <Navigate to={paths.tasks()} replace />;
  const items = tasks.data
    .filter((task) => task.checklistId === checklist.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return <ChecklistDetail checklist={checklist} items={items} />;
}

function ChecklistDetail({ checklist, items }: { checklist: Checklist; items: Task[] }) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = familyNow(family.timeZone, useNow(60_000));
  const persons = usePersons().data ?? [];
  const period = usePeriodText(checklist);
  const progress = checklistProgress(items);
  const overdue = items.some((task) => isChecklistTaskOverdue(task, checklist, now));
  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4"
      data-testid="checklist-detail"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-xl font-semibold break-words">{checklist.name}</h1>
          {period && (
            <p className={`text-sm ${overdue ? "font-medium text-overdue" : "text-muted"}`}>
              {period}
            </p>
          )}
          <p className="text-sm text-muted">
            {t("checklists.progress", { done: progress.done, total: progress.total })}
          </p>
        </div>
        <Link className={BUTTON} to={`/checklists/${checklist.id}/edit`}>
          <Pencil aria-hidden size={16} />
          {t("checklists.edit")}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">{t("checklists.noItems")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((task) => (
            <ItemRow
              key={task.id}
              task={task}
              overdue={isChecklistTaskOverdue(task, checklist, now)}
              persons={persons}
            />
          ))}
        </ul>
      )}
      <AddItem checklist={checklist} />
    </main>
  );
}

/** Saves an item's name and Persons; its other stored fields go back as they were. */
function itemBody(task: Task, patch: { title: string; personIds: string[] }) {
  return {
    title: patch.title,
    notes: task.notes,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    personIds: patch.personIds,
    private: task.private,
    repetition: null,
    checklistId: task.checklistId,
  };
}

/** One item: a plain tick box, its name and Persons, and buttons to rename or remove it. */
function ItemRow({ task, overdue, persons }: { task: Task; overdue: boolean; persons: Person[] }) {
  const { t } = useTranslation();
  const online = useOnline();
  const tick = useTick();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData<Task[]>(["tasks"], (tasks) =>
        tasks?.filter((x) => x.id !== task.id),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  if (editing) {
    return (
      <li className="py-2">
        <ItemEditor task={task} persons={persons} onDone={() => setEditing(false)} />
      </li>
    );
  }
  const done = Boolean(task.doneAt);
  return (
    <li className="flex items-center gap-3 py-2" data-testid="checklist-item">
      <input
        type="checkbox"
        className="size-5"
        aria-label={t("tasks.tick", { title: task.title })}
        checked={done}
        disabled={tick.isPending || !online}
        onChange={(e) => tick.mutate({ task, done: e.target.checked })}
      />
      <span
        className={`min-w-0 flex-1 break-words ${done ? "text-muted line-through" : overdue ? "text-overdue" : ""}`}
      >
        {task.title}
      </span>
      <span className="flex -space-x-1">
        {task.personIds.map((id) => {
          const person = persons.find((p) => p.id === id);
          return person ? <PersonAvatar key={id} person={person} size={22} /> : null;
        })}
      </span>
      <button
        type="button"
        className={BUTTON}
        aria-label={t("checklists.editItem", { title: task.title })}
        disabled={!online}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden size={16} />
      </button>
      <button
        type="button"
        className={BUTTON_DANGER}
        aria-label={t("checklists.removeItem", { title: task.title })}
        disabled={!online || remove.isPending}
        onClick={() => remove.mutate()}
      >
        <Trash2 aria-hidden size={16} />
      </button>
    </li>
  );
}

function ItemEditor({
  task,
  persons,
  onDone,
}: {
  task: Task;
  persons: Person[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [personIds, setPersonIds] = useState(task.personIds);
  const save = useMutation({
    mutationFn: () =>
      api(`/tasks/${task.id}`, { method: "PUT", body: itemBody(task, { title, personIds }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onDone();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={t("checklists.itemName")}>
        <TextInput required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">{t("checklists.itemPersons")}</legend>
        <div className="flex flex-wrap gap-3">
          {persons
            .filter((p) => !p.archived || personIds.includes(p.id))
            .map((p) => (
              <label key={p.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={personIds.includes(p.id)}
                  onChange={(e) =>
                    setPersonIds(
                      e.target.checked
                        ? [...personIds, p.id]
                        : personIds.filter((id) => id !== p.id),
                    )
                  }
                />
                <PersonAvatar person={p} size={24} />
                {p.name}
              </label>
            ))}
        </div>
      </fieldset>
      {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON} onClick={onDone}>
          {t("settings.cancel")}
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
          {t("persons.save")}
        </button>
      </div>
    </form>
  );
}

/** Quick-add: a name and Add; the new item takes the Checklist's default Persons. */
function AddItem({ checklist }: { checklist: Checklist }) {
  const { t } = useTranslation();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const add = useMutation({
    mutationFn: (name: string) =>
      api("/tasks", {
        method: "POST",
        body: { title: name, personIds: checklist.personIds, checklistId: checklist.id },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    add.mutate(name);
    setTitle("");
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t("checklists.newItem")}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className={BUTTON_PRIMARY} disabled={!online || !title.trim()}>
          <Plus aria-hidden size={16} />
          {t("checklists.addItem")}
        </button>
      </div>
      {add.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </form>
  );
}
