import { useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { api } from "../api";
import { Field, TextInput } from "../screens/form";
import {
  canListen,
  getReadback,
  isYes,
  listenOnce,
  speak,
  stopListening,
  stopSpeaking,
} from "./speech";

type Create = { outcome: "create"; kind: "entry" | "task"; values: object; summary: string };
type Answer = Create | { outcome: "failed"; sentence: string };
type Toast = { kind: "entry" | "task"; id: string };

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
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
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
      setToast({ kind: create.kind, id: saved.id });
    } catch {
      setError(true);
      setPhase("readback");
    } finally {
      saving.current = false;
    }
  }

  async function readBack(create: Create) {
    const mine = ++run.current;
    await speak(`${create.summary} ${t("voice.saveQuestion")}`, lang);
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
    const { kind, id } = toast;
    setToast(null);
    try {
      await api(`/${route(kind)}/${id}`, { method: "DELETE" });
    } finally {
      await invalidate();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("voice.open")}
        className="ml-auto rounded-md p-2 hover:bg-stone-200 dark:hover:bg-stone-800"
        onClick={() => setOpen(true)}
      >
        <Mic aria-hidden size={20} strokeWidth={1.75} />
      </button>
      {open && (
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
            {phase === "readback" && pending ? (
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
                    className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white"
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
                {error && (
                  <p role="alert" className="text-sm text-overdue">
                    {t("voice.failed")}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={phase === "sending" || !text.trim()}
                    className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
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
            <button type="button" className="self-end text-sm underline" onClick={close}>
              {t("voice.cancel")}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm shadow-lg"
          >
            <span>{t("voice.saved")} ·</span>
            <button type="button" className="font-medium underline" onClick={() => void undo()}>
              {t("voice.undo")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
