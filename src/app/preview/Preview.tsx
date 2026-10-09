import { Lock, Pencil, Repeat } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { isChecklistTaskOverdue, checklistProgress } from "../../core/checklist";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import { usePeriodText } from "../checklists/period";
import { useChecklists, type Checklist } from "../checklists/model";
import { useDisplayMode } from "../display/mode";
import { EntrySummary } from "../entries/EntrySummary";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useNow } from "../shell/useNow";
import { TaskRow } from "../tasks/TaskRow";
import { useTasks, useTick, type Task } from "../tasks/model";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { Tick } from "../ui/Toggle";

/** What a preview shows: an Entry (on one Occurrence), a Task or a Checklist. */
export type PreviewTarget =
  | { kind: "entry"; id: string; occurrence: string | null; edit: string }
  | { kind: "task"; id: string }
  | { kind: "checklist"; id: string };

const OpenPreview = createContext<(target: PreviewTarget) => void>(() => {});

/** Opens the preview of an Entry, a Task or a Checklist; the one open already closes. */
export function usePreview() {
  return useContext(OpenPreview);
}

/**
 * A click that opens a preview instead of following its link; a click with a modifier key still
 * opens the link (in a new tab, say).
 */
export function previewClick(open: (target: PreviewTarget) => void, target: PreviewTarget) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    open(target);
  };
}

/** Where an Entry block's own link points, as a preview: an Entry, or a Checklist's period bar. */
export function targetOf(href: string): PreviewTarget | null {
  const url = new URL(href, "http://x");
  const checklist = /^\/checklists\/([^/]+)$/.exec(url.pathname);
  if (checklist) return { kind: "checklist", id: checklist[1] };
  const entry = /^\/entries\/([^/]+)$/.exec(url.pathname);
  if (entry)
    return {
      kind: "entry",
      id: entry[1],
      occurrence: url.searchParams.get("occurrence"),
      edit: href,
    };
  return null;
}

/**
 * Holds the one preview open in the app: a small card over the view with Edit and Cancel.
 * A tap outside it closes it, and a tap on another item opens that one's instead.
 */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Kept with the view it was opened in: leaving the view closes it.
  const [open, setOpen] = useState<{ target: PreviewTarget; at: string } | null>(null);
  const target = open?.at === pathname ? open.target : null;
  const show = useCallback((t: PreviewTarget) => setOpen({ target: t, at: pathname }), [pathname]);
  return (
    <OpenPreview.Provider value={show}>
      {children}
      {target && (
        <PreviewCard key={JSON.stringify(target)} target={target} onClose={() => setOpen(null)} />
      )}
    </OpenPreview.Provider>
  );
}

function PreviewCard({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const card = useRef<HTMLDivElement>(null);
  // On the wall nothing is edited, and a Private Entry shows only "Private" and its time.
  const wall = useDisplayMode();
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node)) onClose();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  useEffect(() => card.current?.focus(), []);

  const edit =
    target.kind === "entry"
      ? target.edit
      : target.kind === "task"
        ? `/tasks/${target.id}`
        : `/checklists/${target.id}`;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:inset-auto sm:right-4 sm:bottom-4">
      <div
        ref={card}
        role="dialog"
        aria-labelledby="preview-title"
        tabIndex={-1}
        data-testid="preview"
        className="pointer-events-auto flex max-h-[70dvh] w-full max-w-md flex-col rounded-2xl border border-line bg-frame shadow-xl outline-none"
      >
        <div className="min-h-0 overflow-y-auto p-4">
          {target.kind === "entry" && (
            <EntrySummary
              id={target.id}
              occurrence={target.occurrence}
              discreet={wall}
              titleId="preview-title"
            />
          )}
          {target.kind === "task" && <TaskSummary id={target.id} titleId="preview-title" />}
          {target.kind === "checklist" && (
            <ChecklistSummary id={target.id} titleId="preview-title" />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-3">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("preview.cancel")}
          </button>
          {!wall && (
            <Link to={edit} className={BUTTON_PRIMARY}>
              <Pencil aria-hidden size={16} />
              {t("preview.edit")}
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A Task to read: tick, title, when, Persons, its Checklist and notes. */
export function TaskSummary({ id, titleId }: { id: string; titleId?: string }) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const tasks = useTasks();
  const checklists = useChecklists();
  const persons = usePersons().data ?? [];
  const tick = useTick();
  const wall = useDisplayMode();
  const task = tasks.data?.find((x) => x.id === id);
  if (!task) return null;
  const hidden = wall && task.private;
  const checklist = checklists.data?.find((c) => c.id === task.checklistId);
  const due = task.dueDate
    ? [
        formatPlainDate(task.dueDate, locale, { weekday: "long", day: "numeric", month: "long" }),
        task.dueTime,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const people = task.personIds
    .map((pid) => persons.find((p) => p.id === pid))
    .filter((p) => p !== undefined);
  return (
    <div className="flex flex-col gap-3" data-testid="task-summary">
      <div className="flex items-start gap-3">
        <Tick
          className="-my-1 -ml-2"
          aria-label={t("tasks.tick", { title: task.title })}
          checked={Boolean(task.doneAt)}
          disabled={tick.isPending}
          onChange={(e) => tick.mutate({ task, done: e.target.checked })}
        />
        <h2
          id={titleId}
          className={`min-w-0 flex-1 text-xl font-semibold break-words ${task.doneAt ? "text-muted line-through" : ""}`}
        >
          {hidden ? t("entries.private") : task.title}
          {task.repetition && (
            <Repeat aria-label={t("tasks.repeats")} className="ml-1 inline" size={16} />
          )}
          {task.private && (
            <Lock aria-label={t("entries.private")} className="ml-1 inline" size={16} />
          )}
        </h2>
      </div>
      {due && <p className="first-letter:uppercase">{due}</p>}
      {!hidden && (
        <>
          {checklist && (
            <p className="text-muted">{t("preview.inChecklist", { name: checklist.name })}</p>
          )}
          {people.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <PersonAvatar person={p} size={28} />
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          {task.notes && <p className="whitespace-pre-wrap">{task.notes}</p>}
        </>
      )}
    </div>
  );
}

/** A Checklist to read: its name, period, progress and items, each tickable. */
export function ChecklistSummary({ id, titleId }: { id: string; titleId?: string }) {
  const checklists = useChecklists();
  const tasks = useTasks();
  const checklist = checklists.data?.find((c) => c.id === id);
  if (!checklist || !tasks.data) return null;
  const items = tasks.data
    .filter((task) => task.checklistId === checklist.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return <ChecklistBody checklist={checklist} items={items} titleId={titleId} />;
}

function ChecklistBody({
  checklist,
  items,
  titleId,
}: {
  checklist: Checklist;
  items: Task[];
  titleId?: string;
}) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = familyNow(family.timeZone, useNow(60_000));
  const persons = usePersons().data ?? [];
  const period = usePeriodText(checklist);
  const progress = checklistProgress(items);
  const overdue = items.some((task) => isChecklistTaskOverdue(task, checklist, now));
  return (
    <div className="flex flex-col gap-2" data-testid="checklist-summary">
      <h2 id={titleId} className="text-xl font-semibold break-words">
        {checklist.name}
      </h2>
      {period && (
        <p className={`text-sm ${overdue ? "font-medium text-overdue" : "text-muted"}`}>{period}</p>
      )}
      <p className="text-sm text-muted">
        {t("checklists.progress", { done: progress.done, total: progress.total })}
      </p>
      {items.length === 0 ? (
        <p className="text-muted">{t("checklists.noItems")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              overdue={isChecklistTaskOverdue(task, checklist, now)}
              persons={persons}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
