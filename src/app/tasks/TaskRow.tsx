import { Lock, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useTick, type Task } from "./model";

/** One Task with its tick box; done ones are struck through. */
export function TaskRow({
  task,
  overdue,
  persons,
}: {
  task: Task;
  overdue: boolean;
  persons: Person[];
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const tick = useTick();
  const done = Boolean(task.doneAt);
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
      <input
        type="checkbox"
        className="size-5"
        aria-label={t("tasks.tick", { title: task.title })}
        checked={done}
        disabled={tick.isPending}
        onChange={(e) => tick.mutate({ task, done: e.target.checked })}
      />
      <Link to={`/tasks/${task.id}`} className="flex min-w-0 flex-1 flex-col">
        <span className={`break-words ${done ? "text-muted line-through" : ""}`}>
          {task.title}
          {task.repetition && (
            <Repeat aria-label={t("tasks.repeats")} className="ml-1 inline" size={14} />
          )}
          {task.private && (
            <Lock aria-label={t("entries.private")} className="ml-1 inline" size={14} />
          )}
        </span>
        {due && (
          <span className={`text-xs ${overdue ? "font-medium text-overdue" : "text-muted"}`}>
            {due}
          </span>
        )}
      </Link>
      <span className="flex -space-x-1">
        {task.personIds.map((id) => {
          const person = persons.find((p) => p.id === id);
          return person ? <PersonAvatar key={id} person={person} size={22} /> : null;
        })}
      </span>
    </li>
  );
}
