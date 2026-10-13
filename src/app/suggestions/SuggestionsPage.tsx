import { useQueryClient } from "@tanstack/react-query";
import { Check, Lightbulb, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatLocale } from "../../core/languages";
import { todayIn } from "../../core/plain-date";
import {
  AREAS,
  BANDS,
  draftsFor,
  IDEAS,
  MAX_TEXT,
  sortPhrases,
  themeOf,
  type Answers,
  type Area,
  type Band,
  type Idea,
  type Payment,
  type WrittenDraft,
} from "../../core/suggestions";
import { foldName } from "../../core/shopping-sections";
import { shoppingToAdd } from "../../core/shopping-phrase";
import { api } from "../api";
import { useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { addShoppingItems, refreshShopping, type ShoppingItem } from "../shopping/model";
import { useTasks } from "../tasks/model";
import { Field } from "../screens/form";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { canListen, listenOnce } from "../voice/speech";
import { describeItem, itemOf, requestOf, type Edit, type Item } from "./model";
import { ReviewDialog } from "./ReviewDialog";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

type Written = { key: string; keep: boolean; draft: WrittenDraft };
type Created = { route: "entries" | "tasks" | "shopping/items"; id: string };
type ToBuy = { key: string; name: string; keep: boolean };

/**
 * Suggestions: write or say what repeats in the Family's life, or open a theme ("car", "the
 * dog") to tick its ideas, then review the list and create it all at once. Nothing is saved
 * until "Create"; Undo removes everything that was just created.
 */
export function SuggestionsPage() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const today = todayIn(family.timeZone);
  const queryClient = useQueryClient();
  const types = useEntryTypes().data;
  const general = types?.find((type) => type.builtinKey === "general");

  const [text, setText] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [payment, setPayment] = useState<Record<string, Payment>>({});
  const [answers, setAnswers] = useState<Answers>({
    registration: null,
    iucBand: "upTo100",
    imiBand: "upTo500",
    expiry: {},
  });
  const [written, setWritten] = useState<Written[]>([]);
  const [toBuy, setToBuy] = useState<ToBuy[]>([]);
  /** The names just put on the Shopping List, for the banner. */
  const [bought, setBought] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [reading, setReading] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created[] | null>(null);
  // Ideas created on this visit, and those whose Task is already there from an earlier one.
  const [madeNow, setMadeNow] = useState<string[]>([]);
  const taskTitles = (useTasks().data ?? []).map((task) => task.title);
  const isMade = (idea: Idea) =>
    madeNow.includes(idea.id) ||
    taskTitles.some((title) => title.startsWith(t(`suggestions.ideas.${idea.id}`)));
  const banner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (created) banner.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [created]);

  const draftsOf = (idea: Idea) => draftsFor(idea, payment[idea.id] ?? "manual", answers, today);
  const items: Item[] = (() => {
    const fromIdeas = IDEAS.filter((idea) => picked[idea.id])
      .flatMap((idea) => draftsFor(idea, payment[idea.id] ?? "manual", answers, today))
      .map((draft) => itemOf(draft, t));
    const fromBox = written
      .filter((w) => w.keep)
      .map((w) => ({ ...w.draft, key: w.key, notes: "", debit: false, type: "general" as const }));
    return [...fromIdeas, ...fromBox]
      .map((item) => ({ ...item, ...edits[item.key] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  const buying = toBuy.filter((b) => b.keep).map((b) => b.name);
  const count = items.length + buying.length;

  const openArea = (area: Area) =>
    setAreas((open) => (open.includes(area) ? open : [...open, area]));

  async function read() {
    const { shopping, phrases } = sortPhrases(text);
    if (phrases.length === 0 && shopping.length === 0) return;
    setMessage(null);
    if (shopping.length > 0) {
      const stamp = Date.now();
      setToBuy((list) => [
        ...list,
        ...shopping
          .filter((name) => !list.some((b) => foldName(b.name) === foldName(name)))
          .map((name, i) => ({ key: `b${stamp}-${i}`, name, keep: true })),
      ]);
    }
    const rest: string[] = [];
    for (const phrase of phrases) {
      const area = themeOf(phrase);
      if (area) openArea(area);
      else rest.push(phrase);
    }
    if (rest.length === 0) {
      setText("");
      return;
    }
    setReading(true);
    try {
      const answer = await api<{ outcome: string; items?: WrittenDraft[] }>("/suggestions/read", {
        method: "POST",
        body: { phrases: rest },
      });
      if (answer.outcome !== "read" || !answer.items || answer.items.length === 0) {
        setMessage(t("suggestions.failed"));
        return;
      }
      const stamp = Date.now();
      setWritten((list) => [
        ...list,
        ...answer.items!.map((draft, i) => ({ key: `w${stamp}-${i}`, keep: true, draft })),
      ]);
      setText("");
    } catch {
      setMessage(t("suggestions.failed"));
    } finally {
      setReading(false);
    }
  }

  async function listen() {
    setListening(true);
    const heard = await listenOnce(language);
    setListening(false);
    if (heard) setText((current) => (current.trim() ? `${current.trim()}, ${heard}` : heard));
  }

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entries"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      refreshShopping(queryClient),
    ]);

  async function create() {
    if (!types || !general) return;
    setCreating(true);
    setMessage(null);
    const done: Created[] = [];
    try {
      for (const item of items) {
        const { route, body } = requestOf(item, types, today);
        const saved = await api<{ id: string }>(`/${route}`, { method: "POST", body });
        done.push({ route, id: saved.id });
      }
      let added: string[] = [];
      let already: string[] = [];
      if (buying.length > 0) {
        // What is already open on the Shopping List isn't added twice.
        const onList = await api<ShoppingItem[]>("/shopping/items");
        ({ add: added, already } = shoppingToAdd(buying, onList));
        const ids = await addShoppingItems(added.map((name) => ({ name })));
        done.push(...ids.map((id) => ({ route: "shopping/items" as const, id })));
      }
      setMadeNow((ids) => [...ids, ...IDEAS.filter((idea) => picked[idea.id]).map((i) => i.id)]);
      setPicked({});
      setWritten([]);
      setToBuy([]);
      setEdits({});
      setReviewing(false);
      setBought(added);
      setCreated(done.length > 0 ? done : null);
      if (already.length > 0) {
        setMessage(t("shopping.alreadyOnList", { names: already.join(", ") }));
      }
    } catch {
      // All or nothing: what was created before the failure goes again, so a retry is clean.
      for (const c of done) await api(`/${c.route}/${c.id}`, { method: "DELETE" }).catch(() => {});
      setMessage(t("suggestions.createFailed"));
    } finally {
      setCreating(false);
      await invalidate();
    }
  }

  async function undo() {
    if (!created) return;
    const list = created;
    setCreated(null);
    setMadeNow([]);
    for (const c of list) await api(`/${c.route}/${c.id}`, { method: "DELETE" }).catch(() => {});
    await invalidate();
    setMessage(t("suggestions.undone"));
  }

  const calendarCount = created?.filter((c) => c.route !== "shopping/items").length ?? 0;
  const closedAreas = AREAS.filter((area) => !areas.includes(area));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-0">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Lightbulb aria-hidden size={22} strokeWidth={1.75} />
          {t("suggestions.title")}
        </h1>
        <p className="text-sm text-muted">{t("suggestions.lead")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <label htmlFor="suggestions-text" className="text-sm font-medium">
          {t("suggestions.box")}
        </label>
        <textarea
          id="suggestions-text"
          className={`${INPUT} min-h-24`}
          maxLength={MAX_TEXT}
          placeholder={t("suggestions.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {canListen() && (
            <button
              type="button"
              className={BUTTON}
              onClick={() => void listen()}
              disabled={listening}
            >
              <Mic aria-hidden size={16} />
              {listening ? t("voice.listening") : t("suggestions.listen")}
            </button>
          )}
          <button
            type="button"
            className={BUTTON_PRIMARY}
            onClick={() => void read()}
            disabled={reading || !text.trim()}
          >
            {reading ? t("suggestions.reading") : t("suggestions.read")}
          </button>
        </div>
        {message && (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        )}
      </section>

      {created && (
        <div
          ref={banner}
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-surface p-3 text-sm"
        >
          <span className="flex flex-1 flex-col gap-1">
            {calendarCount > 0 && <span>{t("suggestions.created", { count: calendarCount })}</span>}
            {bought.length > 0 && <span>{t("shopping.added", { names: bought.join(", ") })}</span>}
          </span>
          <button type="button" className={BUTTON} onClick={() => void undo()}>
            {t("suggestions.undo")}
          </button>
          {calendarCount > 0 && (
            <Link to={paths.tasks()} className={BUTTON}>
              {t("suggestions.seeTasks")}
            </Link>
          )}
          {bought.length > 0 && (
            <Link to={paths.shopping()} className={BUTTON}>
              {t("shopping.open")}
            </Link>
          )}
        </div>
      )}

      {toBuy.length > 0 && (
        <section aria-labelledby="to-buy-title" className="flex flex-col gap-2">
          <h2 id="to-buy-title" className="font-semibold">
            {t("shopping.title")}
          </h2>
          <p className="text-sm text-muted" data-testid="suggestions-shopping">
            {t("shopping.addFromText", { names: buying.join(", ") || "—" })}
          </p>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {toBuy.map((b) => (
              <li key={b.key}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-accent"
                    checked={b.keep}
                    onChange={(e) =>
                      setToBuy((list) =>
                        list.map((x) => (x.key === b.key ? { ...x, keep: e.target.checked } : x)),
                      )
                    }
                  />
                  <span className="font-medium">{b.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {written.length > 0 && (
        <section aria-labelledby="written-title" className="flex flex-col gap-2">
          <h2 id="written-title" className="font-semibold">
            {t("suggestions.written")}
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {written.map((w) => (
              <li key={w.key} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-accent"
                  aria-label={w.draft.title}
                  checked={w.keep}
                  onChange={(e) =>
                    setWritten((list) =>
                      list.map((x) => (x.key === w.key ? { ...x, keep: e.target.checked } : x)),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{w.draft.title}</div>
                  <div className="text-sm text-muted">
                    {describeItem({ ...w.draft, ...edits[w.key] }, t, locale)}
                  </div>
                </div>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={t("suggestions.switchKind", { title: w.draft.title })}
                  onClick={() =>
                    setWritten((list) =>
                      list.map((x) =>
                        x.key === w.key
                          ? {
                              ...x,
                              draft: {
                                ...x.draft,
                                kind: x.draft.kind === "task" ? "entry" : "task",
                              },
                            }
                          : x,
                      ),
                    )
                  }
                >
                  {t(`suggestions.kinds.${w.draft.kind}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {areas.map((area) => (
        <section key={area} aria-labelledby={`area-${area}`} className="flex flex-col gap-2">
          <h2 id={`area-${area}`} className="font-semibold">
            {t(`suggestions.areas.${area}.name`)}
          </h2>
          <p className="text-sm text-muted">{t(`suggestions.areas.${area}.intro`)}</p>
          <AreaQuestions area={area} answers={answers} onChange={setAnswers} />
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {IDEAS.filter((idea) => idea.area === area).map((idea) => {
              const on = Boolean(picked[idea.id]);
              const drafts = on ? draftsOf(idea) : [];
              return (
                <li key={idea.id} className="flex flex-col gap-2 px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-accent"
                      checked={on}
                      onChange={(e) => setPicked((p) => ({ ...p, [idea.id]: e.target.checked }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {t(`suggestions.ideas.${idea.id}`)}
                        {isMade(idea) && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-accent-ink">
                            <Check aria-hidden size={12} strokeWidth={3} />
                            {t("suggestions.made")}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-muted">
                        {!on
                          ? t(`suggestions.hints.${idea.id}`, { defaultValue: "" })
                          : drafts.length === 0
                            ? t("suggestions.needsAnswer")
                            : drafts
                                .map((d) => describeItem({ ...d, ...edits[d.key] }, t, locale))
                                .join(" · ")}
                      </span>
                    </span>
                  </label>
                  {on && idea.bill && (
                    <div
                      role="radiogroup"
                      aria-label={t("suggestions.payment.label")}
                      className="ml-8 flex flex-wrap gap-2"
                    >
                      {(["manual", "debit"] as const).map((p) => (
                        <label
                          key={p}
                          className="relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink"
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`pay-${idea.id}`}
                            checked={(payment[idea.id] ?? "manual") === p}
                            onChange={() => setPayment((x) => ({ ...x, [idea.id]: p }))}
                          />
                          {t(`suggestions.payment.${p}`)}
                        </label>
                      ))}
                    </div>
                  )}
                  {on && idea.rule.type === "expiry" && (
                    <div className="ml-8">
                      <Field label={t("suggestions.questions.expiry")}>
                        <input
                          type="date"
                          className={INPUT}
                          value={answers.expiry[idea.id] ?? ""}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              expiry: { ...a.expiry, [idea.id]: e.target.value || null },
                            }))
                          }
                        />
                      </Field>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {closedAreas.length > 0 && (
        <section aria-labelledby="themes-title" className="flex flex-col gap-2">
          <h2 id="themes-title" className="font-semibold">
            {t("suggestions.themes")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {closedAreas.map((area) => (
              <button key={area} type="button" className={BUTTON} onClick={() => openArea(area)}>
                + {t(`suggestions.areas.${area}.name`)}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-[5] -mx-4 mt-auto flex items-center justify-between gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-muted">{t("suggestions.count", { count })}</span>
        <button
          type="button"
          className={BUTTON_PRIMARY}
          disabled={count === 0}
          onClick={() => {
            setMessage(null);
            setReviewing(true);
          }}
        >
          {t("suggestions.review")}
        </button>
      </div>

      {reviewing && (
        <ReviewDialog
          items={items}
          shopping={buying}
          busy={creating || !general}
          error={creating ? null : message}
          onEdit={(key, edit) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...edit } }))}
          onCreate={() => void create()}
          onClose={() => setReviewing(false)}
        />
      )}
    </main>
  );
}

/** The few questions an area needs once: the car's registration and how much the taxes are. */
function AreaQuestions({
  area,
  answers,
  onChange,
}: {
  area: Area;
  answers: Answers;
  onChange: (update: (a: Answers) => Answers) => void;
}) {
  const { t } = useTranslation();
  const band = (field: "iucBand" | "imiBand", label: string) => (
    <Field label={label}>
      <select
        className={INPUT}
        value={answers[field]}
        onChange={(e) => onChange((a) => ({ ...a, [field]: e.target.value as Band }))}
      >
        {BANDS.map((b) => (
          <option key={b} value={b}>
            {t(`suggestions.bands.${b}`)}
          </option>
        ))}
      </select>
    </Field>
  );
  if (area === "car") {
    return (
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface/60 p-3">
        <Field label={t("suggestions.questions.registration")}>
          <input
            type="date"
            className={INPUT}
            value={answers.registration ?? ""}
            onChange={(e) => onChange((a) => ({ ...a, registration: e.target.value || null }))}
          />
        </Field>
        {band("iucBand", t("suggestions.questions.iucBand"))}
      </div>
    );
  }
  if (area === "home") {
    return (
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface/60 p-3">
        {band("imiBand", t("suggestions.questions.imiBand"))}
      </div>
    );
  }
  return null;
}
