import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ListChecks, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistProgress } from "../../core/checklist";
import { api } from "../api";
import { useChecklists, type Checklist } from "../checklists/model";
import { useOnline } from "../offline/online";
import { useTasks, useTick, type Task } from "../tasks/model";
import { BUTTON } from "../ui/button";
import { Tick } from "../ui/Toggle";
import { useEntry } from "./model";

const SELECT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

/** A Checklist's settings as its PUT takes them, with another Entry (or none). */
function checklistBody(checklist: Checklist, entryId: string | null) {
  const { name, startDate, endDate, repetition, remindAtStart, personIds } = checklist;
  return { name, startDate, endDate, repetition, remindAtStart, personIds, entryId };
}

/**
 * What an Entry needs done beforehand: the Checklists and loose Tasks linked to it, each
 * Checklist with its progress and each Task to tick, plus new ones or existing ones to link.
 */
export function EntryPreparation({
  entryId,
  className = "border-t border-line pt-3",
}: {
  entryId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const queryClient = useQueryClient();
  const checklists = useChecklists().data ?? [];
  const tasks = useTasks().data ?? [];
  const [choice, setChoice] = useState("");
  const linkedLists = checklists.filter((c) => c.entryId === entryId);
  const linkedTasks = tasks.filter((task) => !task.checklistId && task.entryId === entryId);
  const freeLists = checklists.filter((c) => !c.entryId);
  const freeTasks = tasks.filter((task) => !task.checklistId && !task.entryId && !task.doneAt);
  const link = useMutation({
    mutationFn: (value: string) => {
      const [kind, id] = value.split(":");
      if (kind === "checklist") {
        const checklist = checklists.find((c) => c.id === id)!;
        return api(`/checklists/${id}`, { method: "PUT", body: checklistBody(checklist, entryId) });
      }
      const task = tasks.find((x) => x.id === id)!;
      return api(`/tasks/${id}`, { method: "PUT", body: { ...task, entryId } });
    },
    onSettled: async () => {
      setChoice("");
      await queryClient.invalidateQueries({ queryKey: ["checklists"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  return (
    <section className={`flex flex-col gap-2 ${className}`} data-testid="preparation">
      <h3 className="font-semibold">{t("preparation.title")}</h3>
      {linkedLists.length + linkedTasks.length === 0 && (
        <p className="text-sm text-muted">{t("preparation.none")}</p>
      )}
      <ul className="flex flex-col gap-1">
        {linkedLists.map((checklist) => {
          const progress = checklistProgress(
            tasks.filter((task) => task.checklistId === checklist.id),
          );
          return (
            <li key={checklist.id}>
              <Link
                to={`/checklists/${checklist.id}`}
                className="flex items-center gap-2 rounded-md py-1 hover:bg-surface"
              >
                <ListChecks aria-hidden size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 break-words">{checklist.name}</span>
                <span className="text-sm text-muted">{t("checklists.progress", progress)}</span>
              </Link>
            </li>
          );
        })}
        {linkedTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link className={BUTTON} to={`/checklists/new?entry=${entryId}`}>
          <Plus aria-hidden size={16} />
          {t("preparation.newChecklist")}
        </Link>
        <Link className={BUTTON} to={`/tasks/new?entry=${entryId}`}>
          <Plus aria-hidden size={16} />
          {t("preparation.newTask")}
        </Link>
      </div>
      {freeLists.length + freeTasks.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("preparation.linkExisting")}</span>
          <select
            className={SELECT}
            value={choice}
            disabled={!online || link.isPending}
            onChange={(e) => {
              setChoice(e.target.value);
              if (e.target.value) link.mutate(e.target.value);
            }}
          >
            <option value="">{t("preparation.choose")}</option>
            {freeLists.length > 0 && (
              <optgroup label={t("preparation.checklists")}>
                {freeLists.map((c) => (
                  <option key={c.id} value={`checklist:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {freeTasks.length > 0 && (
              <optgroup label={t("preparation.tasks")}>
                {freeTasks.map((task) => (
                  <option key={task.id} value={`task:${task.id}`}>
                    {task.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}
    </section>
  );
}

/** A linked Task to tick; the tick shows the moment it's clicked, before the server answers. */
function TaskRow({ task }: { task: Task }) {
  const { t } = useTranslation();
  const online = useOnline();
  const tick = useTick();
  const [ticking, setTicking] = useState<boolean | null>(null);
  const done = ticking ?? Boolean(task.doneAt);
  return (
    <li className="flex items-center gap-2">
      <Tick
        className="-my-2 -ml-2"
        aria-label={t("tasks.tick", { title: task.title })}
        checked={done}
        disabled={tick.isPending || !online}
        onChange={(e) => {
          setTicking(e.target.checked);
          tick.mutate({ task, done: e.target.checked }, { onSettled: () => setTicking(null) });
        }}
      />
      <Link
        to={`/tasks/${task.id}`}
        className={`min-w-0 flex-1 break-words ${done ? "text-muted line-through" : ""}`}
      >
        {task.title}
      </Link>
    </li>
  );
}

/** In a Checklist's or Task's form: the Entry it prepares for, with a button to unlink it. */
export function LinkedEntry({ entryId, onUnlink }: { entryId: string; onUnlink: () => void }) {
  const { t } = useTranslation();
  const entry = useEntry(entryId);
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="linked-entry">
      <CalendarDays aria-hidden size={16} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 break-words">
        {t("preparation.for", { title: entry.data?.title ?? "…" })}
      </span>
      <button
        type="button"
        className={BUTTON}
        aria-label={t("preparation.unlink")}
        onClick={onUnlink}
      >
        <X aria-hidden size={16} />
      </button>
    </div>
  );
}
