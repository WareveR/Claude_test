import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Attachments } from "../attachments/Attachments";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { checklistProgress, isChecklistTaskOverdue } from "../../core/checklist";
import { templateText } from "../../core/checklist-template";
import { familyNow, type FamilyNow } from "../../core/task";
import { childrenByParent, descendantIds, leafProgress } from "../../core/task-tree";
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
import { Chip, Tick } from "../ui/Toggle";
import { useChecklists, type Checklist } from "./model";
import { usePeriodText } from "./period";
import { useTemplates, type ChecklistTemplate } from "./templates";
import { useSwipeAway } from "./useSwipeAway";

/** A Checklist with every item to tick, add, rename or remove; its settings sit behind Edit. */
export function ChecklistDetailPage() {
  const { id } = useParams();
  const checklists = useChecklists();
  const tasks = useTasks();
  if (!checklists.data || !tasks.data) return null;
  const checklist = checklists.data.find((c) => c.id === id);
  // A Checklist saved a moment ago may only arrive with the refetch of a stale list.
  if (!checklist) return checklists.isFetching ? null : <Navigate to={paths.tasks()} replace />;
  const items = tasks.data
    .filter((task) => task.checklistId === checklist.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return <ChecklistDetail checklist={checklist} items={items} />;
}

function ChecklistDetail({ checklist, items: all }: { checklist: Checklist; items: Task[] }) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const removal = useRemoveWithUndo();
  // A swiped-away item is hidden at once, with what's inside it, and only deleted when its Undo
  // runs out.
  const hidden = removal.waiting
    ? [removal.waiting.id, ...descendantIds(all, removal.waiting.id)]
    : [];
  const items = all.filter((task) => !hidden.includes(task.id));
  const now = familyNow(family.timeZone, useNow(60_000));
  const persons = usePersons().data ?? [];
  const period = usePeriodText(checklist);
  const progress = checklistProgress(items);
  const overdue = items.some((task) => isChecklistTaskOverdue(task, checklist, now));
  // Where new items go: the top, the last place used, or the item whose Add button was pressed.
  const [addParent, setAddParent] = useState("");
  // Items with items open and close like an accordion; a finished one starts closed.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const addName = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Back where the Checklist was opened from, or to the Tasks view when opened directly.
  const back = () =>
    (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(paths.tasks());
  const tree: TreeContext = {
    checklist,
    items,
    children: childrenByParent(items),
    now,
    persons,
    isOpen: (task) => opened[task.id] ?? !task.doneAt,
    toggle: (task, open) => setOpened((o) => ({ ...o, [task.id]: open })),
    addInside: (task) => {
      setAddParent(task.id);
      setOpened((o) => ({ ...o, [task.id]: true }));
      addName.current?.focus();
    },
    remove: removal.remove,
  };
  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 pb-0"
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
      <SaveAsTemplate checklist={checklist} items={items} />
      {items.length === 0 ? (
        <p className="text-muted">{t("checklists.noItems")}</p>
      ) : (
        <ItemList parent="" tree={tree} />
      )}
      <AddItem
        checklist={checklist}
        items={items}
        parent={items.some((task) => task.id === addParent) ? addParent : ""}
        onParent={setAddParent}
        nameRef={addName}
      />
      <Attachments owner={`checklist=${checklist.id}`} />
      <div className="sticky bottom-0 z-[5] -mx-4 mt-auto flex justify-end gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <button type="button" className={BUTTON} onClick={back}>
          <ArrowLeft aria-hidden size={16} />
          {t("settings.back")}
        </button>
      </div>
      {removal.waiting && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm shadow-lg"
          >
            <span className="break-words">
              {t("checklists.removed", { title: removal.waiting.title })} ·
            </span>
            <button type="button" className={BUTTON} onClick={removal.undo}>
              {t("checklists.undo")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** What every row of the item tree needs, handed down from the page. */
type TreeContext = {
  checklist: Checklist;
  items: Task[];
  /** Each item's items, in the order they were added; "" holds the top of the list. */
  children: Map<string, Task[]>;
  now: FamilyNow;
  persons: Person[];
  isOpen: (task: Task) => boolean;
  toggle: (task: Task, open: boolean) => void;
  addInside: (task: Task) => void;
  remove: (task: Task) => void;
};

/** The items inside one item, or at the top of the list, each with its own items below it. */
function ItemList({ parent, tree }: { parent: string; tree: TreeContext }) {
  return (
    <ul
      className={`divide-y divide-line ${parent ? "ml-3 border-l-2 border-line pl-3" : ""}`}
      data-testid={parent ? "checklist-subitems" : undefined}
    >
      {(tree.children.get(parent) ?? []).map((task) => (
        <ItemRow key={task.id} task={task} tree={tree} />
      ))}
    </ul>
  );
}

/**
 * The places an item can go, in list order and indented by depth: the top of the list, then
 * every item but `except` (an item can't go inside itself or its own items).
 */
function placesFor(items: Task[], except?: string) {
  const children = childrenByParent(items);
  const left = except ? new Set([except, ...descendantIds(items, except)]) : new Set<string>();
  const places: { id: string; label: string }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const task of children.get(parent) ?? []) {
      if (left.has(task.id)) continue;
      places.push({ id: task.id, label: `${" ".repeat(depth)}${task.title}` });
      walk(task.id, depth + 1);
    }
  };
  walk("", 0);
  return places;
}

const UNDO_MS = 6000;

/**
 * Removing an item with a few seconds to Undo: it is deleted when the time runs out, when
 * another item is removed, or when the page or the app is left.
 */
function useRemoveWithUndo() {
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState<Task | null>(null);
  const pending = useRef<{ task: Task; timer: number } | null>(null);
  const commit = useRef((task: Task) => {
    queryClient.setQueryData<Task[]>(["tasks"], (tasks) => tasks?.filter((x) => x.id !== task.id));
    void api(`/tasks/${task.id}`, { method: "DELETE" })
      .catch(() => undefined)
      .finally(() => queryClient.invalidateQueries({ queryKey: ["tasks"] }));
  });
  const flush = () => {
    const current = pending.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    pending.current = null;
    commit.current(current.task);
  };
  useEffect(() => {
    // Leaving the app altogether still deletes it: a keepalive request outlives the page.
    const leave = () => {
      const current = pending.current;
      if (!current) return;
      window.clearTimeout(current.timer);
      pending.current = null;
      void fetch(`/api/tasks/${current.task.id}`, { method: "DELETE", keepalive: true });
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      flush();
    };
  }, []);
  return {
    waiting,
    remove(task: Task) {
      flush();
      const timer = window.setTimeout(() => {
        flush();
        setWaiting(null);
      }, UNDO_MS);
      pending.current = { task, timer };
      setWaiting(task);
    },
    undo() {
      if (pending.current) window.clearTimeout(pending.current.timer);
      pending.current = null;
      setWaiting(null);
    },
  };
}

type ItemPatch = { title: string; notes: string; parentId: string | null; personIds: string[] };

/** Saves an item's name, note, place and Persons; its other stored fields go back as they were. */
function itemBody(task: Task, patch: ItemPatch) {
  return {
    title: patch.title,
    notes: patch.notes,
    parentId: patch.parentId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    personIds: patch.personIds,
    private: task.private,
    repetition: null,
    checklistId: task.checklistId,
  };
}

/**
 * One item: a plain tick box, its name, note and Persons, and buttons to edit or remove it.
 * Dragging or swiping it sideways removes it too. An item with items shows how many are done,
 * opens and closes them like an accordion, and has a button to add one more inside.
 */
function ItemRow({ task, tree }: { task: Task; tree: TreeContext }) {
  const { t } = useTranslation();
  const online = useOnline();
  const tick = useTick();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const swipe = useSwipeAway(() => tree.remove(task));
  // The tick shows the moment it's clicked, before the server answers.
  const [ticking, setTicking] = useState<boolean | null>(null);
  const remove = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const gone = new Set([task.id, ...descendantIds(tree.items, task.id)]);
      queryClient.setQueryData<Task[]>(["tasks"], (tasks) => tasks?.filter((x) => !gone.has(x.id)));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const own = tree.children.get(task.id);
  const open = Boolean(own) && tree.isOpen(task);
  if (editing) {
    return (
      <li className="py-2">
        <ItemEditor task={task} tree={tree} onDone={() => setEditing(false)} />
      </li>
    );
  }
  const done = ticking ?? Boolean(task.doneAt);
  const overdue = isChecklistTaskOverdue(task, tree.checklist, tree.now);
  const progress = own ? leafProgress(tree.items, task.id) : null;
  const title = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        className={`break-words ${done ? "text-muted line-through" : overdue ? "text-overdue" : ""}`}
      >
        {task.title}
      </span>
      {task.notes && (
        <span className="text-sm break-words text-muted" data-testid="checklist-item-note">
          {task.notes}
        </span>
      )}
    </span>
  );
  return (
    <li>
      <div
        className="flex cursor-grab items-center gap-3 bg-bg py-2 select-none"
        data-testid="checklist-item"
        style={swipe.style}
        {...swipe.handlers}
      >
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
        {progress ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={open}
            aria-label={t("checklists.itemsOf", { title: task.title })}
            onClick={() => tree.toggle(task, !open)}
          >
            <ChevronDown
              aria-hidden
              size={18}
              className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
            />
            {title}
            <span className="shrink-0 text-sm text-muted" data-testid="checklist-item-progress">
              {t("checklists.progress", progress)}
            </span>
          </button>
        ) : (
          title
        )}
        <span className="flex -space-x-1">
          {task.personIds.map((id) => {
            const person = tree.persons.find((p) => p.id === id);
            return person ? <PersonAvatar key={id} person={person} size={22} /> : null;
          })}
        </span>
        <button
          type="button"
          className={BUTTON}
          aria-label={t("checklists.addInside", { title: task.title })}
          disabled={!online}
          onClick={() => tree.addInside(task)}
        >
          <Plus aria-hidden size={16} />
        </button>
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
      </div>
      {open && <ItemList parent={task.id} tree={tree} />}
    </li>
  );
}

function ItemEditor({ task, tree, onDone }: { task: Task; tree: TreeContext; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [parentId, setParentId] = useState(task.parentId ?? "");
  const [personIds, setPersonIds] = useState(task.personIds);
  const save = useMutation({
    mutationFn: () =>
      api(`/tasks/${task.id}`, {
        method: "PUT",
        body: itemBody(task, { title, notes, parentId: parentId || null, personIds }),
      }),
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
      <Field label={t("checklists.itemNote")}>
        <TextInput
          value={notes}
          placeholder={t("checklists.itemNoteHint")}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <PlaceSelect
        places={placesFor(tree.items, task.id)}
        value={parentId}
        onChange={setParentId}
      />
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">{t("checklists.itemPersons")}</legend>
        <div className="flex flex-wrap gap-3">
          {tree.persons
            .filter((p) => !p.archived || personIds.includes(p.id))
            .map((p) => (
              <Chip
                key={p.id}
                checked={personIds.includes(p.id)}
                onChange={(e) =>
                  setPersonIds(
                    e.target.checked ? [...personIds, p.id] : personIds.filter((id) => id !== p.id),
                  )
                }
              >
                <PersonAvatar person={p} size={24} />
                {p.name}
              </Chip>
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

const SELECT = "rounded-md border border-line bg-surface px-3 py-2 text-base";

/** Where an item goes: the top of the list, or inside another item. */
function PlaceSelect({
  places,
  value,
  onChange,
}: {
  places: { id: string; label: string }[];
  value: string;
  onChange: (parentId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field label={t("checklists.itemParent")}>
      <select className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("checklists.itemParentTop")}</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Quick-add: a name, an optional note, where it goes, and Add; the new item takes the
 * Checklist's default Persons. The place stays for the next item, so a run of items can go
 * inside the same one. A predefined list adds all its items there at once.
 */
function AddItem({
  checklist,
  items,
  parent,
  onParent,
  nameRef,
}: {
  checklist: Checklist;
  items: Task[];
  parent: string;
  onParent: (parentId: string) => void;
  nameRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const online = useOnline();
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const add = useMutation({
    mutationFn: (item: { title: string; notes: string }) =>
      api("/tasks", {
        method: "POST",
        body: {
          ...item,
          parentId: parent || null,
          personIds: checklist.personIds,
          checklistId: checklist.id,
        },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const addList = useMutation({
    mutationFn: async (template: ChecklistTemplate) => {
      const { name, items: names } = templateText(template, language);
      await api(`/checklists/${checklist.id}/items`, {
        method: "POST",
        body: { parentId: parent || null, items: names },
      });
      return { name, count: names.length };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    add.mutate({ title: name, notes: notes.trim() });
    setTitle("");
    setNotes("");
    nameRef.current?.focus();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t("checklists.newItem")}>
            <TextInput
              ref={nameRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setTitle("")}
            />
          </Field>
        </div>
        <button type="submit" className={BUTTON_PRIMARY} disabled={!online || !title.trim()}>
          <Plus aria-hidden size={16} />
          {t("checklists.addItem")}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("checklists.itemNote")}>
          <TextInput
            value={notes}
            placeholder={t("checklists.itemNoteHint")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <PlaceSelect places={placesFor(items)} value={parent} onChange={onParent} />
      </div>
      {(templates.data?.length ?? 0) > 0 && (
        <Field label={t("checklists.usePredefined")}>
          <select
            className={SELECT}
            value=""
            disabled={!online || addList.isPending}
            onChange={(e) => {
              const template = templates.data?.find((tpl) => tpl.id === e.target.value);
              if (template) addList.mutate(template);
            }}
          >
            <option value="">…</option>
            {templates.data?.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {templateText(tpl, language).name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {addList.data && (
        <p role="status" className="text-sm text-muted">
          {t("checklists.predefinedAdded", addList.data)}
        </p>
      )}
      {(add.error || addList.error) && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </form>
  );
}

/** Keeps this Checklist's name and items, in their order, as a new template. */
function SaveAsTemplate({ checklist, items }: { checklist: Checklist; items: Task[] }) {
  const { t } = useTranslation();
  const online = useOnline();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api("/checklist-templates", {
        method: "POST",
        // A predefined list is flat: the items that hold none, in list order.
        body: { name: checklist.name, items: leafTitles(items) },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
  });
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={BUTTON}
        disabled={!online || save.isPending}
        onClick={() => save.mutate()}
      >
        <BookmarkPlus aria-hidden size={16} color="#16a34a" />
        {t("checklistTemplates.saveAs")}
      </button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-muted">
          {t("checklistTemplates.saved", { name: checklist.name })}
        </p>
      )}
      {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </div>
  );
}

function leafTitles(items: Task[]) {
  const children = childrenByParent(items);
  const titles: string[] = [];
  const walk = (parent: string) => {
    for (const task of children.get(parent) ?? []) {
      if (children.has(task.id)) walk(task.id);
      else titles.push(task.title);
    }
  };
  walk("");
  return titles;
}
