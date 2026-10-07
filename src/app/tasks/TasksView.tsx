import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistGroup, isChecklistTaskOverdue } from "../../core/checklist";
import { checklistMatches, matchesFilter } from "../../core/person-filter";
import { familyNow, groupTasks, isOverdue, type TaskGroups } from "../../core/task";
import { ChecklistRow } from "../checklists/ChecklistRow";
import { useChecklists, type Checklist } from "../checklists/model";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { useTasks, type Task } from "./model";
import { TaskRow } from "./TaskRow";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { Switch } from "../ui/Toggle";

const GROUPS = ["overdue", "today", "upcoming", "noDate"] as const;
type Group = keyof TaskGroups<Task>;

/**
 * Overdue, Today, Upcoming and No date, with done Tasks behind "Show done". A Checklist is one
 * row in the group of its end; its dated Tasks also show alone, its undated ones only inside it.
 */
export function TasksView() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = familyNow(family.timeZone, useNow());
  const tasks = useTasks();
  const checklists = useChecklists().data ?? [];
  const persons = usePersons().data ?? [];
  const [showDone, setShowDone] = useState(false);
  const all = tasks.data ?? [];
  const checklistOf = (task: Task) => checklists.find((c) => c.id === task.checklistId);
  const filter = usePersonFilter();
  const groups = groupTasks(
    all.filter(
      (task) => (!task.checklistId || task.dueDate) && matchesFilter(task.personIds, filter),
    ),
    now,
  );
  const listsIn: Record<Group, Checklist[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    noDate: [],
    done: [],
  };
  for (const checklist of checklists) {
    const own = all.filter((task) => task.checklistId === checklist.id);
    if (
      !checklistMatches(
        own.map((task) => task.personIds),
        filter,
      )
    )
      continue;
    listsIn[checklistGroup(checklist, own, now)].push(checklist);
  }

  const row = (task: Task) => {
    const checklist = checklistOf(task);
    return (
      <TaskRow
        key={task.id}
        task={task}
        overdue={checklist ? isChecklistTaskOverdue(task, checklist, now) : isOverdue(task, now)}
        persons={persons}
        label={checklist?.name}
      />
    );
  };
  const listRow = (checklist: Checklist) => (
    <ChecklistRow
      key={checklist.id}
      checklist={checklist}
      tasks={all.filter((task) => task.checklistId === checklist.id)}
      persons={persons}
      now={now}
    />
  );
  const count = (g: Group) => groups[g].length + listsIn[g].length;
  const section = (g: Group, title: ReactNode) => (
    <section key={g} aria-label={t(`tasks.groups.${g}`)}>
      {title}
      <ul className="divide-y divide-line">
        {listsIn[g].map(listRow)}
        {groups[g].map(row)}
      </ul>
    </section>
  );

  return (
    <>
      <ViewNav date={now.today} title={t("views.tasks")} newPath={null} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/tasks/new" className={BUTTON_PRIMARY}>
            <Plus aria-hidden size={16} />
            {t("tasks.new")}
          </Link>
          <Link to="/checklists/new" className={BUTTON}>
            <Plus aria-hidden size={16} />
            {t("checklists.new")}
          </Link>
        </div>
        {tasks.data && GROUPS.every((g) => count(g) === 0) && (
          <p className="text-muted">{t("tasks.nothingLeft")}</p>
        )}
        {GROUPS.filter((g) => count(g) > 0).map((g) =>
          section(
            g,
            <h2
              className={`text-sm font-semibold uppercase tracking-wide ${g === "overdue" ? "text-overdue" : "text-muted"}`}
            >
              {t(`tasks.groups.${g}`)} · {count(g)}
            </h2>,
          ),
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          {t("tasks.showDone", { count: count("done") })}
        </label>
        {showDone && count("done") > 0 && section("done", null)}
      </main>
    </>
  );
}
