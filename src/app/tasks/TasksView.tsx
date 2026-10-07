import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistGroup } from "../../core/checklist";
import { checklistMatches, matchesFilter } from "../../core/person-filter";
import { familyNow, groupTasks, isOverdue, type TaskGroups } from "../../core/task";
import { AddToChecklistDialog } from "../checklists/AddToChecklist";
import { ChecklistRow } from "../checklists/ChecklistRow";
import { useDragToChecklist } from "../checklists/useDragToChecklist";
import { useChecklists, type Checklist } from "../checklists/model";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { useTasks, type Task } from "./model";
import { TaskRow } from "./TaskRow";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";

const GROUPS = ["overdue", "today", "upcoming", "noDate"] as const;
type Group = keyof TaskGroups<Task>;

/**
 * Overdue, Today, Upcoming and No date, with done Tasks behind "Show done". A Checklist is one
 * row in the group of its round's end; its items show only on its own page.
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
  // A loose Task dragged onto a Checklist asks whether to move or duplicate it.
  const [dropped, setDropped] = useState<{ taskId: string; checklistId: string } | null>(null);
  const drag = useDragToChecklist((taskId, checklistId) => setDropped({ taskId, checklistId }));
  const draggedTask = all.find((task) => task.id === drag.dragging);
  const droppedTask = all.find((task) => task.id === dropped?.taskId);
  const droppedOn = checklists.find((checklist) => checklist.id === dropped?.checklistId);
  const filter = usePersonFilter();
  const groups = groupTasks(
    all.filter((task) => !task.checklistId && matchesFilter(task.personIds, filter)),
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

  const row = (task: Task) => (
    <TaskRow key={task.id} task={task} overdue={isOverdue(task, now)} persons={persons} />
  );
  const listRow = (checklist: Checklist) => (
    <ChecklistRow
      key={checklist.id}
      checklist={checklist}
      tasks={all.filter((task) => task.checklistId === checklist.id)}
      now={now}
      dropTarget={drag.over === checklist.id}
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
      <main
        className="task-drag-zone mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-6"
        {...drag.zone}
      >
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
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          {t("tasks.showDone", { count: count("done") })}
        </label>
        {showDone && count("done") > 0 && section("done", null)}
        {checklists.length > 0 && GROUPS.some((g) => groups[g].length > 0) && (
          <p className="text-xs text-muted">{t("checklists.dragHint")}</p>
        )}
      </main>
      {draggedTask &&
        createPortal(
          <div
            ref={drag.ghost}
            aria-hidden
            style={drag.ghostStyle}
            className="pointer-events-none fixed top-0 left-0 z-30 max-w-64 truncate rounded-md border border-accent bg-surface px-3 py-2 text-sm shadow-lg"
          >
            {draggedTask.title}
          </div>,
          document.body,
        )}
      {droppedTask && droppedOn && (
        <AddToChecklistDialog
          task={droppedTask}
          checklist={droppedOn}
          onClose={() => setDropped(null)}
        />
      )}
    </>
  );
}
