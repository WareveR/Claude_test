import { useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { api } from "../api";
import { reportFailure } from "../errors/store";
import { Field, TextInput } from "../screens/form";
import {
  canListen,
  getReadback,
  isYes,
  listenOnce,
  matchOption,
  matchScope,
  speak,
  stopListening,
  stopSpeaking,
} from "./speech";
import { BUTTON } from "../ui/button";

type Create = { outcome: "create"; kind: "entry" | "task"; values: object; summary: string };
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
};
type Notice = "notFound" | "oneAtATime" | "refused" | "locked";
type Answer =
  | Create
  | { outcome: "failed"; sentence: string }
  | { outcome: "change"; plan: Plan }
  | { outcome: "choose"; options: Plan[] }
  | { outcome: Notice };
type Scope = "this" | "following" | "all";
/** What the toast's Undo does; null when there is nothing to undo. */
type Toast = { undo: (() => Promise<void>) | null };

const route = (kind: "entry" | "task") => (kind === "entry" ? "entries" : "tasks");

/** The header's microphone: opens the Voice Entry sheet, and shows the "Saved · Undo" toast. */
export function VoiceEntry() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "listening" | "readback">("idle");
  const [pending, setPending] = useState<Create | null>(null);
  const [error, setError] = useState(false);
  const [choices, setChoices] = useState<Plan[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const run = useRef(0);
  const saving = useRef(false);
  const lang = i18n.language;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stopAll = () => {
    run.current += 1;
    stopListening();
    stopSpeaking();
  };
  const close = () => {
    stopAll();
    setOpen(false);
    setPhase("idle");
    setPending(null);
    setChoices(null);
    setPlan(null);
    setScope(null);
    setNotice(null);
    setError(false);
    setText("");
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entries"] }),
      queryClient.invalidateQueries({ queryKey: ["entry"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task"] }),
      queryClient.invalidateQueries({ queryKey: ["checklists"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist"] }),
    ]);

  const openForm = (kind: "entry" | "task", values: object) => {
    close();
    void navigate(kind === "entry" ? "/entries/new" : "/tasks/new", { state: { values } });
  };

  async function save(create: Create) {
    if (saving.current) return;
    saving.current = true;
    stopAll();
    setError(false);
    try {
      const saved = await api<{ id: string }>(`/${route(create.kind)}`, {
        method: "POST",
        body: create.values,
      });
      await invalidate();
      close();
      const undo = async () => {
        try {
          await api(`/${route(create.kind)}/${saved.id}`, { method: "DELETE" });
        } finally {
          await invalidate();
        }
      };
      setToast({ undo });
    } catch {
      setError(true);
      setPhase("readback");
    } finally {
      saving.current = false;
    }
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
      setToast({ undo });
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
    if (!getReadback()) return;
    const mine = ++run.current;
    await speak([chosen.summary, t("voice.saveQuestion")], lang);
    if (run.current !== mine || !canListen()) return;
    const answer = await listenOnce(lang);
    if (run.current !== mine) return;
    if (isYes(answer)) void saveChange(chosen, how);
  }

  async function startPlan(chosen: Plan) {
    if (chosen.scope !== "ask") return confirmPlan(chosen, chosen.scope);
    setPlan(chosen);
    setScope(null);
    setChoices(null);
    setPhase("readback");
    if (!getReadback()) return;
    const mine = ++run.current;
    await speak(t("voice.scopeQuestion"), lang);
    if (run.current !== mine || !canListen()) return;
    const how = matchScope(await listenOnce(lang));
    if (run.current !== mine) return;
    if (how) void confirmPlan(chosen, how);
  }

  async function startChoice(options: Plan[]) {
    setChoices(options);
    setPlan(null);
    setPhase("readback");
    if (!getReadback()) return;
    const mine = ++run.current;
    const labels = options.map((o) => o.label);
    await speak([t("voice.which"), ...labels.map((l, i) => `${i + 1}. ${l}`)], lang);
    if (run.current !== mine || !canListen()) return;
    const index = matchOption(await listenOnce(lang), labels);
    const picked = index === null ? undefined : options[index];
    if (run.current !== mine || !picked) return;
    void startPlan(picked);
  }

  async function readBack(create: Create) {
    const mine = ++run.current;
    await speak([create.summary, t("voice.saveQuestion")], lang);
    if (run.current !== mine || !canListen()) return;
    const answer = await listenOnce(lang);
    if (run.current !== mine) return;
    if (isYes(answer)) void save(create);
    else openForm(create.kind, create.values);
  }

  async function send(sentence: string) {
    const trimmed = sentence.trim().slice(0, 300);
    if (!trimmed) return;
    stopAll();
    setText(trimmed);
    setNotice(null);
    setError(false);
    setPhase("sending");
    const mine = run.current;
    let answer: Answer;
    try {
      answer = await api<Answer>("/voice", { method: "POST", body: { sentence: trimmed } });
    } catch {
      if (run.current !== mine) return;
      setError(true);
      setPhase("idle");
      return;
    }
    if (run.current !== mine) return;
    if (answer.outcome === "failed") return openForm("entry", { title: answer.sentence });
    if (answer.outcome === "change") return void startPlan(answer.plan);
    if (answer.outcome === "choose") return void startChoice(answer.options);
    if (answer.outcome !== "create") {
      setNotice(answer.outcome);
      setPhase("idle");
      if (getReadback()) void speak(t(`voice.${answer.outcome}`), lang);
      return;
    }
    if (!getReadback()) return openForm(answer.kind, answer.values);
    setPending(answer);
    setPhase("readback");
    void readBack(answer);
  }

  async function dictate() {
    stopAll();
    const mine = run.current;
    setError(false);
    setPhase("listening");
    const heard = await listenOnce(lang);
    if (run.current !== mine) return;
    setPhase("idle");
    if (heard) void send(heard);
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
        className="ml-auto rounded-md p-2 hover:bg-header-ink/15"
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
                            onClick={() => void saveChange(plan, scope)}
                          >
                            {t("voice.save")}
                          </button>
                        </div>
                      </>
                    )
                  )}
                </>
              ) : phase === "readback" && pending ? (
                <>
                  <p data-testid="voice-summary">{pending.summary}</p>
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
                      onClick={() => openForm(pending.kind, pending.values)}
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
                  {phase === "listening" && (
                    <p role="status" className="text-sm text-muted">
                      {t("voice.listening")}
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
                        aria-label={t("voice.listen")}
                        disabled={phase === "sending"}
                        className="rounded-md border border-line p-2 disabled:opacity-60"
                        onClick={() => void dictate()}
                      >
                        <Mic aria-hidden size={20} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </form>
              )}
              <button type="button" className={`${BUTTON} self-end`} onClick={close}>
                {t("voice.cancel")}
              </button>
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
            <span>{t("voice.saved")} ·</span>
            {toast.undo && (
              <button type="button" className={BUTTON} onClick={() => void undo()}>
                {t("voice.undo")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
