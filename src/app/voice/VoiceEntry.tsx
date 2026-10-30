import { useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { api } from "../api";
import { reportFailure } from "../errors/store";
import { paths } from "../paths";
import { addShoppingItems, refreshShopping, removeShoppingItems } from "../shopping/model";
import { Field, TextInput } from "../screens/form";
import { readAnswer } from "../../core/voice-answer";
import type { VoiceOpen } from "../../core/voice-open";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import {
  canListen,
  finishListening,
  getReadback,
  listen,
  listenOnce,
  matchOption,
  matchScope,
  speak,
  stopListening,
  stopSpeaking,
  type OnLevel,
} from "./speech";
import { BUTTON } from "../ui/button";
import { VoiceStatus, type Activity } from "./VoiceStatus";

type Kind = "entry" | "task" | "checklist" | "person" | "template";
/** A Task with items comes as a Checklist, with what the Task form opens on Edit. */
type TaskWithItems = { values: object; templateId: string | null; items: string[] };
type Proposal = { kind: Kind; values: object; summary: string; form?: TaskWithItems };
/** A new Entry or Task, and any more the same sentence named ("me at 10, my wife at 11"). */
type Create = Proposal & { outcome: "create"; more?: Proposal[] };
type Req = { method: "PUT" | "POST" | "DELETE"; path: string; body?: unknown };
type Plan = {
  kind: "entry" | "task";
  id: string;
  date: string | null;
  label: string;
  summary: string;
  scope: "all" | "this" | "following" | "ask";
  apply: { all?: Req[]; this?: Req[]; following?: Req[] };
  undo: Req[] | null;
  /** Deletes instead of changing; never undone. */
  remove?: true;
};
/** Things to put on the Shopping List; `already` are open on it and left out. */
type Shopping = {
  outcome: "shopping";
  items: { name: string; store: string }[];
  already: string[];
};
type Notice = "notFound" | "oneAtATime" | "locked" | "personExists" | "listExists";
type Answer =
  | Create
  | { outcome: "failed"; sentence: string }
  | { outcome: "change"; plan: Plan }
  | { outcome: "choose"; options: Plan[] }
  | Shopping
  | { outcome: "answer"; text: string }
  | ({ outcome: "open" } & VoiceOpen)
  | { outcome: Notice };
type Scope = "this" | "following" | "all";
/** What the toast's Undo does; null when there is nothing to undo. */
type Toast = { undo: (() => Promise<void>) | null; shopping?: boolean; removed?: boolean };

const ROUTES: Record<Kind, string> = {
  entry: "entries",
  task: "tasks",
  checklist: "checklists",
  person: "persons",
  template: "checklist-templates",
};
/** Where Edit opens a new Person or predefined list, filled in. */
const FORMS: Partial<Record<Kind, string>> = {
  person: "/settings/persons/new",
  template: "/settings/checklist-templates/new",
};
const route = (kind: Kind) => ROUTES[kind];

/** Where "open …" goes: a calendar view on the day said (today by default), or a page. */
function pathOf(open: VoiceOpen, today: string): string {
  const date = open.date ?? today;
  switch (open.place) {
    case "day":
    case "week":
    case "month":
    case "year":
    case "agenda":
      return paths[open.place](date);
    case "wall":
      return paths.display();
    case "search":
      return open.query ? `${paths.search()}?q=${encodeURIComponent(open.query)}` : paths.search();
    default:
      return paths[open.place]();
  }
}
const proposalsOf = (create: Create): Proposal[] => [create, ...(create.more ?? [])];
/** As many corrections as the Worker takes after one sentence. */
const MAX_CORRECTIONS = 5;

/** The header's microphone: opens the Voice Entry sheet, and shows the "Saved · Undo" toast. */
export function VoiceEntry() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "listening" | "reading" | "readback">(
    "idle",
  );
  const [pending, setPending] = useState<Create | null>(null);
  const [shopping, setShopping] = useState<Shopping | null>(null);
  const [error, setError] = useState(false);
  const [choices, setChoices] = useState<Plan[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** The answer to a question about the calendar, said aloud when the question was. */
  const [reply, setReply] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [unheard, setUnheard] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [level, setLevel] = useState(0);
  /** What was said after the readback, applied to the first sentence. */
  const [corrections, setCorrections] = useState<string[]>([]);
  const sentence = useRef({ text: "", corrections: [] as string[] });
  const run = useRef(0);
  /** Whether the sentence was spoken; only then does the sheet talk back and listen. */
  const voiced = useRef(false);
  const saving = useRef(false);
  const lang = i18n.language;
  const { family } = useSignedIn();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stopAll = () => {
    run.current += 1;
    stopListening();
    stopSpeaking();
    setActivity(null);
  };
  const alive = (mine: number) => run.current === mine;

  /** Speaks, showing that the app is talking. */
  async function say(mine: number, parts: string | string[]) {
    setActivity("speaking");
    await speak(parts, lang);
    if (alive(mine)) setActivity(null);
  }

  /** Follows the voice while listening: waiting for it, then hearing it. */
  const follow =
    (mine: number): OnLevel =>
    (loud, spoke) => {
      if (!alive(mine)) return;
      setLevel(loud);
      setActivity(spoke ? "hearing" : "waiting");
    };

  /** Listens for an answer, showing that the app waits, hears and then reads it. */
  async function hear(mine: number) {
    setActivity("waiting");
    const heard = await listenOnce(
      lang,
      () => alive(mine) && setActivity("processing"),
      follow(mine),
    );
    if (alive(mine)) setActivity(null);
    return heard;
  }

  /**
   * After the readback: a yes saves, anything else said is a correction applied to the sentence
   * and read back again, "edit" opens the form and "cancel" closes; a plain no asks what to change.
   */
  async function converse(mine: number, onYes: () => void, onForm: () => void) {
    for (let asked = 0; asked < 2; asked++) {
      if (!alive(mine) || !canListen()) return;
      const answer = readAnswer(await hear(mine));
      if (!alive(mine) || answer === "silence") return;
      if (answer === "yes") return onYes();
      if (answer === "cancel") return close();
      if (answer === "form") return onForm();
      if (typeof answer === "object") return adjust(answer.correction, onForm);
      await say(mine, t("voice.whatToChange"));
    }
  }

  /** Reads the sentence again with one more correction; past the limit, the form takes over. */
  function adjust(correction: string, onForm: () => void) {
    const { text, corrections } = sentence.current;
    if (corrections.length >= MAX_CORRECTIONS) return onForm();
    void send(text, true, [...corrections, correction]);
  }
  const close = () => {
    stopAll();
    setOpen(false);
    setPhase("idle");
    setPending(null);
    setShopping(null);
    setChoices(null);
    setPlan(null);
    setScope(null);
    setNotice(null);
    setReply(null);
    setError(false);
    setUnheard(null);
    setText("");
    setCorrections([]);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const talk = () => voiced.current && getReadback();

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entries"] }),
      queryClient.invalidateQueries({ queryKey: ["entry"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task"] }),
      queryClient.invalidateQueries({ queryKey: ["checklists"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist"] }),
      queryClient.invalidateQueries({ queryKey: ["persons"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
    ]);

  const openForm = (kind: "entry" | "task", values: object) => {
    close();
    void navigate(kind === "entry" ? "/entries/new" : "/tasks/new", { state: { values } });
  };

  /** Undoes the Entries and Tasks saved so far. */
  const unsave = async (saved: { kind: Kind; id: string }[]) => {
    try {
      for (const s of saved) await api(`/${route(s.kind)}/${s.id}`, { method: "DELETE" });
    } finally {
      await invalidate();
    }
  };

  async function save(create: Create) {
    if (saving.current) return;
    saving.current = true;
    stopAll();
    setError(false);
    const saved: { kind: Kind; id: string }[] = [];
    try {
      for (const p of proposalsOf(create)) {
        const { id } = await api<{ id: string }>(`/${route(p.kind)}`, {
          method: "POST",
          body: p.values,
        });
        saved.push({ kind: p.kind, id });
      }
      await invalidate();
      close();
      setToast({ undo: () => unsave(saved) });
    } catch {
      // All or nothing: those saved before the failure are taken back.
      if (saved.length > 0) await unsave(saved).catch(() => {});
      setError(true);
      setPhase("readback");
    } finally {
      saving.current = false;
    }
  }

  /** Edit opens the form for one; for several it goes back to the sentence. */
  const edit = (create: Create) => {
    if (!create.more?.length) {
      const form = FORMS[create.kind];
      if (form || create.form) {
        close();
        return void navigate(form ?? "/tasks/new", {
          state: form ? { values: create.values } : { ...create.form, withItems: true },
        });
      }
      return openForm(create.kind === "entry" ? "entry" : "task", create.values);
    }
    stopAll();
    setPending(null);
    setError(false);
    setPhase("idle");
  };

  const shoppingSummary = (answer: Shopping) =>
    t("shopping.addFromText", { names: answer.items.map((i) => i.name).join(", ") });

  async function saveShopping(answer: Shopping) {
    if (saving.current) return;
    saving.current = true;
    stopAll();
    setError(false);
    try {
      const ids = await addShoppingItems(answer.items);
      await refreshShopping(queryClient);
      close();
      const undo = async () => {
        try {
          await removeShoppingItems(ids);
        } finally {
          await refreshShopping(queryClient);
        }
      };
      setToast({ undo, shopping: true });
    } catch {
      await refreshShopping(queryClient);
      setError(true);
      setPhase("readback");
    } finally {
      saving.current = false;
    }
  }

  /** Back to the sentence, to change it. */
  const editSentence = () => {
    stopAll();
    setShopping(null);
    setError(false);
    setPhase("idle");
  };

  async function readBackShopping(answer: Shopping) {
    const mine = ++run.current;
    const already =
      answer.already.length > 0
        ? t("shopping.alreadyOnList", { names: answer.already.join(", ") })
        : null;
    if (answer.items.length === 0) {
      if (already) await say(mine, already);
      return;
    }
    await say(mine, [
      shoppingSummary(answer),
      ...(already ? [already] : []),
      t("voice.saveOrChange"),
    ]);
    await converse(mine, () => void saveShopping(answer), editSentence);
  }

  async function sendAll(requests: Req[]) {
    for (const r of requests) await api(r.path, { method: r.method, body: r.body });
  }

  async function saveChange(chosen: Plan, how: Scope) {
    if (saving.current) return;
    saving.current = true;
    stopAll();
    setError(false);
    try {
      await sendAll(chosen.apply[how] ?? []);
      await invalidate();
      close();
      const back = chosen.undo;
      const undo = back
        ? async () => {
            try {
              await sendAll(back);
            } catch (e) {
              reportFailure(e, "save");
            } finally {
              await invalidate();
            }
          }
        : null;
      setToast({ undo, removed: chosen.remove });
    } catch (e) {
      reportFailure(e, "save");
      await invalidate();
      setError(true);
    } finally {
      saving.current = false;
    }
  }

  async function confirmPlan(chosen: Plan, how: Scope) {
    setPlan(chosen);
    setScope(how);
    setChoices(null);
    setPhase("readback");
    if (!talk()) return;
    const mine = ++run.current;
    await say(mine, [
      chosen.summary,
      t(chosen.remove ? "voice.removeOrChange" : "voice.saveOrChange"),
    ]);
    await converse(mine, () => void saveChange(chosen, how), editSentence);
  }

  async function startPlan(chosen: Plan) {
    if (chosen.scope !== "ask") return confirmPlan(chosen, chosen.scope);
    setPlan(chosen);
    setScope(null);
    setChoices(null);
    setPhase("readback");
    if (!talk()) return;
    const mine = ++run.current;
    await say(mine, t("voice.scopeQuestion"));
    if (!alive(mine) || !canListen()) return;
    const how = matchScope(await hear(mine));
    if (run.current !== mine) return;
    if (how) void confirmPlan(chosen, how);
  }

  async function startChoice(options: Plan[]) {
    setChoices(options);
    setPlan(null);
    setPhase("readback");
    if (!talk()) return;
    const mine = ++run.current;
    const labels = options.map((o) => o.label);
    await say(mine, [t("voice.which"), ...labels.map((l, i) => `${i + 1}. ${l}`)]);
    if (!alive(mine) || !canListen()) return;
    const index = matchOption(await hear(mine), labels);
    const picked = index === null ? undefined : options[index];
    if (run.current !== mine || !picked) return;
    void startPlan(picked);
  }

  async function readBack(create: Create) {
    const mine = ++run.current;
    await say(mine, [...proposalsOf(create).map((p) => p.summary), t("voice.saveOrChange")]);
    // Silence leaves the summary up, with Save and Edit.
    await converse(
      mine,
      () => void save(create),
      () => edit(create),
    );
  }

  /** Listens again for the answer to the summary on screen. */
  function answerAgain() {
    const mine = ++run.current;
    if (pending)
      void converse(
        mine,
        () => void save(pending),
        () => edit(pending),
      );
    else if (shopping) void converse(mine, () => void saveShopping(shopping), editSentence);
    else if (plan && scope) void converse(mine, () => void saveChange(plan, scope), editSentence);
  }

  async function send(said: string, spoken = false, adjusted: string[] = []) {
    const trimmed = said.trim().slice(0, 300);
    if (!trimmed) return;
    stopAll();
    voiced.current = spoken;
    sentence.current = { text: trimmed, corrections: adjusted };
    setCorrections(adjusted);
    setUnheard(null);
    setText(trimmed);
    setNotice(null);
    setReply(null);
    setError(false);
    setPhase("sending");
    const mine = run.current;
    setActivity("processing");
    let answer: Answer;
    try {
      answer = await api<Answer>("/voice", {
        method: "POST",
        body: adjusted.length
          ? { sentence: trimmed, corrections: adjusted }
          : { sentence: trimmed },
      });
    } catch {
      if (run.current !== mine) return;
      setActivity(null);
      setError(true);
      setPhase("idle");
      return;
    }
    if (run.current !== mine) return;
    setActivity(null);
    // A new answer replaces the one on screen.
    setPending(null);
    setShopping(null);
    setChoices(null);
    setPlan(null);
    setScope(null);
    if (answer.outcome === "failed") return openForm("entry", { title: answer.sentence });
    if (answer.outcome === "change") return void startPlan(answer.plan);
    if (answer.outcome === "choose") return void startChoice(answer.options);
    if (answer.outcome === "open") {
      close();
      return void navigate(pathOf(answer, todayIn(family.timeZone)));
    }
    if (answer.outcome === "answer") {
      setReply(answer.text);
      setText("");
      setPhase("idle");
      if (voiced.current) void say(++run.current, answer.text);
      return;
    }
    if (answer.outcome === "shopping") {
      setShopping(answer);
      setPhase("readback");
      if (talk()) void readBackShopping(answer);
      return;
    }
    if (answer.outcome !== "create") {
      setNotice(answer.outcome);
      setPhase("idle");
      if (talk()) void say(++run.current, t(`voice.${answer.outcome}`));
      return;
    }
    setPending(answer);
    setPhase("readback");
    if (talk()) void readBack(answer);
  }

  async function dictate() {
    // A second press while listening ends it and sends what was heard.
    if (phase === "listening") return finishListening();
    stopAll();
    const mine = run.current;
    setError(false);
    setNotice(null);
    setReply(null);
    setUnheard(null);
    setText("");
    setPhase("listening");
    setActivity("waiting");
    const heard = await listen(
      lang,
      (words) => {
        if (run.current === mine) setText(words);
      },
      () => {
        if (run.current !== mine) return;
        setPhase("reading");
        setActivity("processing");
      },
      follow(mine),
    );
    if (run.current !== mine) return;
    setActivity(null);
    setPhase("idle");
    if (heard.text) return void send(heard.text, true);
    setUnheard(heard.error ?? "silence");
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  async function undo() {
    if (!toast) return;
    const { undo } = toast;
    setToast(null);
    await undo?.();
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("voice.open")}
        data-help="voice"
        className="ml-auto shrink-0 rounded-md p-1 hover:bg-header-ink/15 sm:p-2"
        onClick={() => setOpen(true)}
      >
        <Mic aria-hidden size={20} strokeWidth={1.75} />
      </button>
      {open &&
        // On the body, not inside the blurred header, which would trap a fixed overlay.
        createPortal(
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="voice-title"
              className="flex w-full max-w-md flex-col gap-3 rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
            >
              <h2 id="voice-title" className="font-semibold">
                {t("voice.title")}
              </h2>
              {activity && <VoiceStatus activity={activity} level={level} />}
              {phase === "readback" && (choices || plan) ? (
                <>
                  {choices ? (
                    <>
                      <p>{t("voice.which")}</p>
                      <div className="flex flex-col gap-2">
                        {choices.map((option, i) => (
                          <button
                            key={`${option.kind}-${option.id}-${option.date ?? i}`}
                            type="button"
                            className="rounded-md border border-line px-4 py-2 text-left"
                            onClick={() => void startPlan(option)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : plan && scope === null ? (
                    <>
                      <p data-testid="voice-summary">{plan.summary}</p>
                      <p className="text-sm text-muted">{t("voice.scopeQuestion")}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
                          onClick={() => void confirmPlan(plan, "this")}
                        >
                          {t("voice.onlyThis")}
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
                          onClick={() => void confirmPlan(plan, "following")}
                        >
                          {t("voice.fromNowOn")}
                        </button>
                      </div>
                    </>
                  ) : (
                    plan &&
                    scope && (
                      <>
                        <p data-testid="voice-summary">{plan.summary}</p>
                        <p className="text-sm text-muted">
                          {t(plan.remove ? "voice.removeQuestion" : "voice.saveQuestion")}
                        </p>
                        {error && (
                          <p role="alert" className="text-sm text-overdue">
                            {t("voice.saveFailed")}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`rounded-md px-4 py-2 font-medium ${
                              plan.remove
                                ? "border border-overdue bg-surface text-overdue"
                                : "bg-accent text-accent-ink"
                            }`}
                            onClick={() => void saveChange(plan, scope)}
                          >
                            {t(plan.remove ? "voice.remove" : "voice.save")}
                          </button>
                        </div>
                      </>
                    )
                  )}
                </>
              ) : phase === "readback" && shopping ? (
                <>
                  {shopping.items.length > 0 && (
                    <p data-testid="voice-summary">{shoppingSummary(shopping)}</p>
                  )}
                  {shopping.already.length > 0 && (
                    <p data-testid="voice-notice" className="text-sm">
                      {t("shopping.alreadyOnList", { names: shopping.already.join(", ") })}
                    </p>
                  )}
                  {shopping.items.length > 0 && (
                    <p className="text-sm text-muted">{t("voice.saveQuestion")}</p>
                  )}
                  {error && (
                    <p role="alert" className="text-sm text-overdue">
                      {t("voice.saveFailed")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {shopping.items.length > 0 ? (
                      <button
                        type="button"
                        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
                        onClick={() => void saveShopping(shopping)}
                      >
                        {t("voice.save")}
                      </button>
                    ) : (
                      <Link
                        to={paths.shopping()}
                        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
                        onClick={close}
                      >
                        {t("shopping.open")}
                      </Link>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-line px-4 py-2"
                      onClick={editSentence}
                    >
                      {t("voice.edit")}
                    </button>
                  </div>
                </>
              ) : phase === "readback" && pending ? (
                <>
                  {proposalsOf(pending).map((p, i) => (
                    <p key={i} data-testid="voice-summary">
                      {p.summary}
                    </p>
                  ))}
                  <p className="text-sm text-muted">{t("voice.saveQuestion")}</p>
                  {error && (
                    <p role="alert" className="text-sm text-overdue">
                      {t("voice.saveFailed")}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
                      onClick={() => void save(pending)}
                    >
                      {t("voice.save")}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-line px-4 py-2"
                      onClick={() => edit(pending)}
                    >
                      {t("voice.edit")}
                    </button>
                  </div>
                </>
              ) : (
                <form className="flex flex-col gap-2" onSubmit={submit}>
                  <Field label={t("voice.sentence")}>
                    <TextInput
                      autoFocus
                      maxLength={300}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </Field>
                  {unheard && (
                    <p role="alert" className="text-sm text-overdue">
                      {unheard === "denied"
                        ? t("voice.micDenied")
                        : unheard === "dismissed"
                          ? t("voice.micDismissed")
                          : unheard === "silence" ||
                              unheard === "no-speech" ||
                              unheard === "aborted"
                            ? t("voice.notHeard")
                            : t("voice.micFailed", { code: unheard })}
                    </p>
                  )}
                  {reply && (
                    <p data-testid="voice-answer" className="whitespace-pre-line">
                      {reply}
                    </p>
                  )}
                  {notice && (
                    <p data-testid="voice-notice" className="text-sm">
                      {t(`voice.${notice}`)}
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="text-sm text-overdue">
                      {t("voice.failed")}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={phase === "sending" || !text.trim()}
                      className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
                    >
                      {t("voice.send")}
                    </button>
                    {canListen() && (
                      <button
                        type="button"
                        aria-label={phase === "listening" ? t("voice.stop") : t("voice.listen")}
                        aria-pressed={phase === "listening"}
                        disabled={phase === "sending" || phase === "reading"}
                        className={`rounded-md border p-2 disabled:opacity-60 ${
                          phase === "listening"
                            ? "animate-pulse border-accent bg-accent text-accent-ink"
                            : "border-line"
                        }`}
                        onClick={() => void dictate()}
                      >
                        <Mic aria-hidden size={20} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </form>
              )}
              {phase === "readback" && corrections.length > 0 && (
                <p data-testid="voice-corrections" className="text-xs text-muted">
                  {t("voice.corrections", { list: corrections.join(" · ") })}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                {phase === "readback" &&
                  !activity &&
                  canListen() &&
                  (pending || shopping?.items.length || (plan && scope)) && (
                    <button type="button" className={BUTTON} onClick={answerAgain}>
                      <Mic aria-hidden size={16} strokeWidth={1.75} />
                      {t("voice.answer")}
                    </button>
                  )}
                <button type="button" className={`${BUTTON} ml-auto`} onClick={close}>
                  {t("voice.cancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm shadow-lg"
          >
            <span>{t(toast.removed ? "voice.removed" : "voice.saved")} ·</span>
            {toast.undo && (
              <button type="button" className={BUTTON} onClick={() => void undo()}>
                {t("voice.undo")}
              </button>
            )}
            {toast.shopping && (
              <Link to={paths.shopping()} className={BUTTON} onClick={() => setToast(null)}>
                {t("shopping.open")}
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
