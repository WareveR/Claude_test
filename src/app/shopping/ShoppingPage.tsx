import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { formatPlainDate, todayIn } from "../../core/plain-date";
import {
  forStore,
  groupShopping,
  matchSuggestions,
  onListOn,
  openStores,
  sameNameOnList,
  suggestionFor,
  type ShoppingSuggestion,
} from "../../core/shopping";
import { useSwipeAway } from "../checklists/useSwipeAway";
import { useSignedIn } from "../family";
import { useOnline } from "../offline/online";
import { Field, TextInput } from "../screens/form";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { Tick } from "../ui/Toggle";
import {
  newItemId,
  setStoreFilter,
  useAddItem,
  useChangeItem,
  useDeleteItem,
  useShoppingHistory,
  useShoppingItems,
  useStoreFilter,
  type ItemChange,
  type ShoppingItem,
} from "./model";

/**
 * The Family's one Shopping List: added a little at a time, grouped into the sections of a shop,
 * narrowed to one shop, and ticked as things go in the basket. What was bought stays until the
 * end of the day, then only feeds the suggestions and the history.
 */
export function ShoppingPage() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone, useNow(60_000));
  const items = useShoppingItems();
  const history = useShoppingHistory();
  const change = useChangeItem();
  const undo = useUndo();
  const store = useStoreFilter();
  const [showHistory, setShowHistory] = useState(false);

  const onList = (items.data ?? []).filter(
    (item) => onListOn(item, today, family.timeZone) && item.id !== undo.hiddenId,
  );
  const stores = openStores(onList);
  // A shop with nothing left to buy is no longer offered; the list shows every shop instead.
  const chosen = stores.find((s) => s.toLowerCase() === store.toLowerCase()) ?? "";
  const groups = groupShopping(forStore(onList, chosen));
  const hasOpen = groups.sections.length > 0;

  function tick(item: ShoppingItem, bought: boolean, settled?: () => void) {
    change.mutate({ id: item.id, change: { bought } }, { onSettled: settled });
    if (bought) undo.show({ kind: "bought", item });
    else undo.dismiss();
  }

  return (
    <>
      <ViewNav date={today} title={t("shopping.title")} />
      <main
        className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-24"
        data-testid="shopping-list"
      >
        <AddBox
          onList={onList}
          suggestions={history.data?.suggestions ?? []}
          onUnbuy={(item) => tick(item, false)}
        />
        {stores.length > 0 && (
          <div
            role="group"
            aria-label={t("shopping.stores")}
            className="flex flex-wrap gap-2"
            data-testid="shopping-stores"
          >
            {["", ...stores].map((s) => (
              <button
                key={s || "all"}
                type="button"
                aria-pressed={s === chosen}
                onClick={() => setStoreFilter(s)}
                className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                  s === chosen
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface hover:border-accent"
                }`}
              >
                {s || t("shopping.allStores")}
              </button>
            ))}
          </div>
        )}
        {items.data && !hasOpen && (
          <p className="text-muted">{chosen ? t("shopping.emptyStore") : t("shopping.empty")}</p>
        )}
        {groups.sections.map(({ section, items: inSection }) => (
          <section key={section} aria-label={t(`shopping.sections.${section}`)}>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t(`shopping.sections.${section}`)}
            </h2>
            <ul className="divide-y divide-line">
              {inSection.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  stores={history.data?.stores ?? []}
                  onTick={tick}
                  onRemove={() => undo.show({ kind: "removed", item })}
                />
              ))}
            </ul>
          </section>
        ))}
        {groups.bought.length > 0 && (
          <section aria-label={t("shopping.bought")}>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t("shopping.bought")} · {groups.bought.length}
            </h2>
            <ul className="divide-y divide-line">
              {groups.bought.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  stores={history.data?.stores ?? []}
                  onTick={tick}
                  onRemove={() => undo.show({ kind: "removed", item })}
                />
              ))}
            </ul>
          </section>
        )}
        {onList.length > 0 && <p className="text-xs text-muted">{t("shopping.hint")}</p>}
        <div>
          <button
            type="button"
            className={BUTTON}
            aria-expanded={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History aria-hidden size={16} />
            {showHistory ? t("shopping.hideHistory") : t("shopping.history")}
          </button>
        </div>
        {showHistory && <HistoryList onList={onList} />}
      </main>
      {undo.toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
          <div
            role="status"
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm shadow-lg"
          >
            <span className="min-w-0 break-words">
              {t(undo.toast.kind === "bought" ? "shopping.boughtToast" : "shopping.removedToast", {
                name: undo.toast.item.name,
              })}{" "}
              ·
            </span>
            <button type="button" className={BUTTON} onClick={undo.undo}>
              {t("shopping.undo")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

type Toast = { kind: "bought" | "removed"; item: ShoppingItem };

const UNDO_MS = 6000;

/**
 * The few seconds to undo the last tick or removal. A removed item is hidden at once and only
 * deleted when the time runs out, when something else is ticked or removed, or when the page or
 * the app is left; undoing a tick puts the item back to buy.
 */
function useUndo() {
  const change = useChangeItem();
  const remove = useDeleteItem();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef(0);
  const removing = useRef<string | null>(null);
  const commit = useRef((id: string) => remove.mutate(id));
  const flush = () => {
    const id = removing.current;
    removing.current = null;
    if (id) commit.current(id);
  };
  useEffect(() => {
    // Leaving the app altogether still deletes it: a keepalive request outlives the page.
    const leave = () => {
      const id = removing.current;
      removing.current = null;
      if (id) void fetch(`/api/shopping/items/${id}`, { method: "DELETE", keepalive: true });
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.clearTimeout(timer.current);
      flush();
    };
  }, []);
  return {
    toast,
    hiddenId: toast?.kind === "removed" ? toast.item.id : null,
    show(next: Toast) {
      flush();
      window.clearTimeout(timer.current);
      if (next.kind === "removed") removing.current = next.item.id;
      setToast(next);
      timer.current = window.setTimeout(() => {
        flush();
        setToast(null);
      }, UNDO_MS);
    },
    dismiss() {
      if (toast?.kind !== "bought") return;
      window.clearTimeout(timer.current);
      setToast(null);
    },
    undo() {
      window.clearTimeout(timer.current);
      if (toast?.kind === "removed") removing.current = null;
      else if (toast) change.mutate({ id: toast.item.id, change: { bought: false } });
      setToast(null);
    },
  };
}

/**
 * The one box to add with: Enter adds what is typed, and while typing the names of earlier
 * lists are offered, most often bought first; picking one adds it again with its last shop.
 */
function AddBox({
  onList,
  suggestions,
  onUnbuy,
}: {
  onList: ShoppingItem[];
  suggestions: ShoppingSuggestion[];
  onUnbuy: (item: ShoppingItem) => void;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const add = useAddItem();
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [closed, setClosed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const open = onList.filter((item) => !item.boughtAt);
  const matches = closed ? [] : matchSuggestions(suggestions, text, open);

  function put(name: string, from?: ShoppingSuggestion) {
    const clean = name.trim();
    if (!clean) return;
    setText("");
    setActive(-1);
    input.current?.focus();
    // Already on the list: nothing to add, or back to buy if it was ticked today.
    const there = sameNameOnList(onList, clean);
    if (there) {
      if (there.boughtAt) onUnbuy(there);
      return;
    }
    const earlier = from ?? suggestionFor(suggestions, clean);
    add.mutate({
      id: newItemId(),
      name: clean,
      quantity: "",
      note: "",
      store: earlier?.store ?? "",
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const picked = matches[active];
    if (picked) put(picked.name, picked);
    else put(text);
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault();
      setActive((active + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault();
      setActive(active <= 0 ? matches.length - 1 : active - 1);
    } else if (e.key === "Escape") {
      if (matches.length > 0) setClosed(true);
      else setText("");
    }
  }

  return (
    <form onSubmit={submit} className="relative pt-2">
      <div className="flex gap-2">
        <input
          ref={input}
          role="combobox"
          aria-label={t("shopping.addLabel")}
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("shopping.add")}
          value={text}
          disabled={!online}
          onChange={(e) => {
            setText(e.target.value);
            setActive(-1);
            setClosed(false);
          }}
          onKeyDown={keys}
          onBlur={() => setClosed(true)}
          onFocus={() => setClosed(false)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
        />
        <button
          type="submit"
          className={BUTTON_PRIMARY}
          aria-label={t("shopping.addButton")}
          disabled={!online || !text.trim()}
        >
          <Plus aria-hidden size={18} />
        </button>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={t("shopping.suggestions")}
        hidden={matches.length === 0}
        className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg"
      >
        {matches.map((s, i) => (
          <li
            key={s.name}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Keeps the focus in the box, so the list stays open until the pick lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => put(s.name, s)}
            className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
              i === active ? "bg-line/60" : "hover:bg-line/40"
            }`}
          >
            <span className="break-words">{s.name}</span>
            {s.store && <span className="shrink-0 text-xs text-muted">{s.store}</span>}
          </li>
        ))}
      </ul>
    </form>
  );
}

/**
 * One item: a tap anywhere on it ticks it bought or back; its details (quantity, note, shop)
 * open below it; it goes with the bin button or by swiping it sideways.
 */
function ItemRow({
  item,
  stores,
  onTick,
  onRemove,
}: {
  item: ShoppingItem;
  stores: string[];
  onTick: (item: ShoppingItem, bought: boolean, settled: () => void) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const [editing, setEditing] = useState(false);
  const swipe = useSwipeAway(onRemove);
  // The tick shows the moment it's tapped, before the list moves the item.
  const [ticking, setTicking] = useState<boolean | null>(null);
  const bought = ticking ?? Boolean(item.boughtAt);
  const setBought = (to: boolean) => {
    setTicking(to);
    onTick(item, to, () => setTicking(null));
  };
  if (editing) {
    return (
      <li className="py-2">
        <ItemEditor item={item} stores={stores} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li>
      <div
        className="flex cursor-pointer items-center gap-2 bg-bg py-1 select-none"
        data-testid="shopping-item"
        style={swipe.style}
        {...swipe.handlers}
        onClick={(e) => {
          if (!online || swipe.swiped()) return;
          if ((e.target as Element).closest("input, button, a")) return;
          setBought(!bought);
        }}
      >
        <Tick
          className="-ml-2"
          aria-label={t("shopping.tick", { name: item.name })}
          checked={bought}
          disabled={!online}
          onChange={(e) => setBought(e.target.checked)}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`break-words ${bought ? "text-muted line-through" : ""}`}>
            {item.name}
            {item.quantity && <span className="text-muted"> · {item.quantity}</span>}
          </span>
          {item.note && <span className="text-sm break-words text-muted">{item.note}</span>}
        </span>
        {item.store && (
          <span className="max-w-28 shrink-0 truncate rounded-full border border-line px-2 text-xs text-muted">
            {item.store}
          </span>
        )}
        <button
          type="button"
          className={BUTTON}
          aria-label={t("shopping.details", { name: item.name })}
          disabled={!online}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden size={16} />
        </button>
        <button
          type="button"
          className={BUTTON_DANGER}
          aria-label={t("shopping.remove", { name: item.name })}
          disabled={!online}
          onClick={onRemove}
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>
    </li>
  );
}

function ItemEditor({
  item,
  stores,
  onDone,
}: {
  item: ShoppingItem;
  stores: string[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const change = useChangeItem();
  const storesId = useId();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [note, setNote] = useState(item.note);
  const [store, setStore] = useState(item.store);
  function submit(e: FormEvent) {
    e.preventDefault();
    const fields: ItemChange = { quantity, note, store };
    if (name.trim()) fields.name = name;
    change.mutate({ id: item.id, change: fields });
    onDone();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="shopping-editor">
      <Field label={t("shopping.name")}>
        <TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("shopping.quantity")}>
          <TextInput
            value={quantity}
            placeholder={t("shopping.quantityHint")}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label={t("shopping.store")}>
          <TextInput
            value={store}
            list={storesId}
            placeholder={t("shopping.storeHint")}
            onChange={(e) => setStore(e.target.value)}
          />
        </Field>
      </div>
      <datalist id={storesId}>
        {stores.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label={t("shopping.note")}>
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON} onClick={onDone}>
          {t("shopping.cancel")}
        </button>
        <button type="submit" className={BUTTON_PRIMARY}>
          {t("shopping.save")}
        </button>
      </div>
    </form>
  );
}

/** The latest bought items by the day they were bought, each to add again. */
function HistoryList({ onList }: { onList: ShoppingItem[] }) {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const online = useOnline();
  const history = useShoppingHistory();
  const add = useAddItem();
  const bought = history.data?.bought ?? [];
  if (history.data && bought.length === 0) {
    return <p className="text-sm text-muted">{t("shopping.historyEmpty")}</p>;
  }
  const days: { date: string; items: ShoppingItem[] }[] = [];
  for (const item of bought) {
    const date = todayIn(family.timeZone, new Date(item.boughtAt!));
    const day = days.at(-1);
    if (day?.date === date) day.items.push(item);
    else days.push({ date, items: [item] });
  }
  return (
    <section aria-label={t("shopping.history")} className="flex flex-col gap-3">
      {days.map((day) => (
        <div key={day.date}>
          <h3 className="text-xs font-semibold text-muted first-letter:uppercase">
            {formatPlainDate(day.date, language, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          <ul className="divide-y divide-line">
            {day.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-1 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  {item.name}
                  {item.store && <span className="text-muted"> · {item.store}</span>}
                </span>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={t("shopping.addAgain", { name: item.name })}
                  disabled={!online || Boolean(sameNameOnList(onList, item.name))}
                  onClick={() =>
                    add.mutate({
                      id: newItemId(),
                      name: item.name,
                      quantity: item.quantity,
                      note: "",
                      store: item.store,
                    })
                  }
                >
                  <Plus aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
