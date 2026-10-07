import { useOnline } from "../offline/online";
import { Lock, Repeat } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
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
}: {
  task: Task;
  overdue: boolean;
  persons: Person[];
  /** The Checklist a Task shown on its own belongs to. */
  label?: string;
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
    <li className="flex items-center gap-3 py-2" data-testid="task">
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
      <Wrapper wall={wall} id={task.id}>
        <span className={`break-words ${done ? "text-muted line-through" : ""}`}>
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
          </span>
        )}
      </Wrapper>
      <span className="flex -space-x-1">
        {task.personIds.map((id) => {
          const person = persons.find((p) => p.id === id);
          return person ? <PersonAvatar key={id} person={person} size={22} /> : null;
        })}
      </span>
    </li>
  );
}

function Wrapper({ wall, id, children }: { wall: boolean; id: string; children: ReactNode }) {
  const className = "flex min-w-0 flex-1 flex-col";
  return wall ? (
    <div className={className}>{children}</div>
  ) : (
    <Link to={`/tasks/${id}`} className={className}>
      {children}
    </Link>
  );
}
