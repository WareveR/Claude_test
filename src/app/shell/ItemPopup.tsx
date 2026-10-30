import { Flag, Repeat } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Attachments } from "../attachments/Attachments";
import { Link, useLocation, type LinkProps } from "react-router";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { useDisplayMode } from "../display/mode";
import { EntryPopup } from "../entries/EntryPopup";
import { useEntry } from "../entries/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useTask } from "../tasks/model";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";

/** What a popup shows: an Entry (one Occurrence of it) or a loose Task. */
export type PopupItem =
  { kind: "entry"; id: string; occurrence: string } | { kind: "task"; id: string };

const Open = createContext<(item: PopupItem) => void>(() => undefined);

/**
 * Selecting an Entry or a Task anywhere opens it in a popup first, to read, with Edit and Back
 * (which closes it). Leaving the page closes it too.
 */
export function ItemPopupProvider({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  const [opened, setOpened] = useState<PopupItem | null>(null);
  // Any navigation closes it, so it isn't still open on coming back to the page.
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setOpened(null);
  }
  const item = opened;
  const close = () => setOpened(null);
  return (
    <Open.Provider value={setOpened}>
      {children}
      {item?.kind === "entry" && (
        <EntryPopup id={item.id} occurrence={item.occurrence} onClose={close} />
      )}
      {item?.kind === "task" && <TaskPopup id={item.id} onClose={close} />}
    </Open.Provider>
  );
}

/** A plain click opens the popup; a click with a modifier still follows the link. */
function opener(open: (item: PopupItem) => void, item: PopupItem | null) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (!item || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(item);
  };
}

/** A link that opens an item's popup, or follows the link when there's none. */
export function ItemLink({
  item,
  ...props
}: Omit<LinkProps, "onClick"> & { item: PopupItem | null }) {
  const open = useContext(Open);
  return <Link onClick={opener(open, item)} {...props} />;
}

/**
 * A link to an Entry that opens its popup. Entries shown from elsewhere (Birthdays, holidays,
 * feeds) keep their own link.
 */
export function EntryLink({
  entry,
  to,
  ...props
}: Omit<LinkProps, "onClick"> & {
  entry: {
    id: string;
    href?: string | null;
    occurrenceDate?: string;
    time?: { startDate: string };
  };
}) {
  // The wall opens an Entry's read-only details page instead.
  const wall = useDisplayMode();
  const occurrence = entry.occurrenceDate ?? entry.time?.startDate ?? "";
  const item = entry.href || wall ? null : ({ kind: "entry", id: entry.id, occurrence } as const);
  return <ItemLink item={item} to={to} {...props} />;
}

/** A link to a loose Task that opens its popup; a Checklist's item goes to its page. */
export function TaskLink({
  task,
  to,
  ...props
}: Omit<LinkProps, "onClick"> & { task: { id: string; checklistId: string | null } }) {
  const item = task.checklistId ? null : ({ kind: "task", id: task.id } as const);
  return <ItemLink item={item} to={to} {...props} />;
}

/** A Task to read: when it's due, how it repeats, for whom, its note and the Entry it prepares. */
function TaskPopup({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const wall = useDisplayMode();
  const task = useTask(id);
  const persons = usePersons();
  const entry = useEntry(task.data?.entryId ?? undefined);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const data = task.data;
  // On the wall a Private Task shows only "Private"; one hidden from this Account, also its Persons.
  const hidden = (wall && data?.private) || data?.hidden;
  const people = (data?.personIds ?? [])
    .map((pid) => persons.data?.find((p) => p.id === pid))
    .filter((p) => p !== undefined);
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-popup-title"
        className="flex max-h-[85dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-frame p-5 sm:rounded-2xl"
      >
        {data && (
          <div className="flex flex-col gap-2">
            <h2
              id="task-popup-title"
              className={`text-lg font-semibold break-words ${data.doneAt ? "text-muted line-through" : ""}`}
            >
              {data.importance === "high" && !hidden && (
                <Flag
                  aria-label={t("tasks.high")}
                  className="mr-1 inline fill-overdue text-overdue"
                  size={16}
                />
              )}
              {hidden ? t("entries.private") : data.title}
            </h2>
            <p className="text-sm text-muted">
              {data.dueDate
                ? [
                    formatPlainDate(data.dueDate, locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                    data.dueTime,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("tasks.noDueDate")}
              {data.repetition && (
                <Repeat aria-label={t("tasks.repeats")} className="ml-1 inline" size={14} />
              )}
            </p>
            {data.doneAt && (
              <p className="text-sm text-muted">
                {t("tasks.doneAt", {
                  when: new Date(data.doneAt).toLocaleString(i18n.language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
            )}
            {(!hidden || (data.hidden && !wall)) && people.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {people.map((p) => (
                  <span key={p.id} className="flex items-center gap-1">
                    <PersonAvatar person={p} size={20} />
                    {p.name}
                  </span>
                ))}
              </p>
            )}
            {!hidden && entry.data && (
              <p className="text-sm text-muted">
                {t("preparation.for", { title: entry.data.title })}
              </p>
            )}
            {!hidden && data.notes && (
              <p className="text-sm break-words whitespace-pre-wrap">{data.notes}</p>
            )}
            {!hidden && (
              <Attachments owner={`task=${id}`} readOnly className="border-t border-line pt-3" />
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          {!wall && !data?.hidden && (
            <Link to={`/tasks/${id}`} className={BUTTON_PRIMARY} data-help="edit">
              {t("entries.edit")}
            </Link>
          )}
          <button type="button" className={BUTTON} data-help="back" onClick={onClose}>
            {t("settings.back")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
