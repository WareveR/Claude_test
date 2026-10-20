import { useOnline } from "../offline/online";
import { Flag, Lock, Repeat } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TaskLink } from "../shell/ItemPopup";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { useDisplayMode } from "../display/mode";
import { useSignedIn } from "../family";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useTick, type Task } from "./model";
import { Tick } from "../ui/Toggle";

/** One Task with its tick box; done ones are struck through. */
export function TaskRow({
  task,
  overdue,
  persons,
  label,
  lateDays,
  actions,
}: {
  task: Task;
  overdue: boolean;
  /** Days past its due date, shown in the Tasks view's Overdue group. */
  lateDays?: number;
  persons: Person[];
  /** The Checklist a Task shown on its own belongs to. */
  label?: string;
  /** Buttons on a line of their own under the Task, such as moving it to today. */
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const tick = useTick();
  const online = useOnline();
  // On the wall a Task can be ticked, not opened, and a Private one shows only "Private".
  const wall = useDisplayMode();
  // The tick shows the moment it's clicked, before the server answers.
  const [ticking, setTicking] = useState<boolean | null>(null);
  const done = ticking ?? Boolean(task.doneAt);
  const due = task.dueDate
    ? [
        formatPlainDate(task.dueDate, locale, { weekday: "short", day: "numeric", month: "short" }),
        task.dueTime,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="task">
      <Tick
        className="-my-2 -ml-2"
        aria-label={t("tasks.tick", { title: task.title })}
        checked={done}
        disabled={tick.isPending || !online || task.hidden}
        onChange={(e) => {
          setTicking(e.target.checked);
          tick.mutate({ task, done: e.target.checked }, { onSettled: () => setTicking(null) });
        }}
      />
      <Wrapper wall={wall} task={task}>
        <span className={`break-words ${done ? "text-muted line-through" : ""}`}>
          {task.importance === "high" && !done && (
            <Flag
              aria-label={t("tasks.high")}
              className="mr-1 inline fill-overdue text-overdue"
              size={14}
            />
          )}
          {wall && task.private ? t("entries.private") : task.title}
          {task.repetition && (
            <Repeat aria-label={t("tasks.repeats")} className="ml-1 inline" size={14} />
          )}
          {task.private && (
            <Lock aria-label={t("entries.private")} className="ml-1 inline" size={14} />
          )}
        </span>
        {label && !(wall && task.private) && <span className="text-xs text-muted">{label}</span>}
        {due && (
          <span className={`text-xs ${overdue ? "font-medium text-overdue" : "text-muted"}`}>
            {due}
            {lateDays !== undefined &&
              ` · ${lateDays > 0 ? t("tasks.lateBy", { count: lateDays }) : t("tasks.lateToday")}`}
          </span>
        )}
      </Wrapper>
      <span className="flex -space-x-1">
        {task.personIds.map((id) => {
          const person = persons.find((p) => p.id === id);
          return person ? <PersonAvatar key={id} person={person} size={22} /> : null;
        })}
      </span>
      {actions && <span className="flex basis-full flex-wrap gap-2 pl-9">{actions}</span>}
    </li>
  );
}

function Wrapper({ wall, task, children }: { wall: boolean; task: Task; children: ReactNode }) {
  const className = "flex min-w-0 flex-1 flex-col";
  return wall ? (
    <div className={className}>{children}</div>
  ) : (
    <TaskLink task={task} to={`/tasks/${task.id}`} className={className}>
      {children}
    </TaskLink>
  );
}
