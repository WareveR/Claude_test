import { useState } from "react";
import { useTranslation } from "react-i18next";
import { familyNow, groupTasks, isOverdue } from "../../core/task";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { useTasks, type Task } from "./model";
import { TaskRow } from "./TaskRow";

const GROUPS = ["overdue", "today", "upcoming", "noDate"] as const;

/** Overdue, Today, Upcoming and No date, with done Tasks behind "Show done". */
export function TasksView() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = familyNow(family.timeZone, useNow());
  const tasks = useTasks();
  const persons = usePersons().data ?? [];
  const [showDone, setShowDone] = useState(false);
  const groups = groupTasks(tasks.data ?? [], now);
  const row = (task: Task) => (
    <TaskRow key={task.id} task={task} overdue={isOverdue(task, now)} persons={persons} />
  );
  const empty = GROUPS.every((g) => groups[g].length === 0);

  return (
    <>
      <ViewNav date={now.today} title={t("views.tasks")} newPath="/tasks/new" />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-6">
        {tasks.data && empty && <p className="text-muted">{t("tasks.nothingLeft")}</p>}
        {GROUPS.filter((g) => groups[g].length > 0).map((g) => (
          <section key={g} aria-label={t(`tasks.groups.${g}`)}>
            <h2
              className={`text-sm font-semibold uppercase tracking-wide ${g === "overdue" ? "text-overdue" : "text-muted"}`}
            >
              {t(`tasks.groups.${g}`)} · {groups[g].length}
            </h2>
            <ul className="divide-y divide-line">{groups[g].map(row)}</ul>
          </section>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          {t("tasks.showDone", { count: groups.done.length })}
        </label>
        {showDone && groups.done.length > 0 && (
          <section aria-label={t("tasks.groups.done")}>
            <ul className="divide-y divide-line">{groups.done.map(row)}</ul>
          </section>
        )}
      </main>
    </>
  );
}
