import { useSyncExternalStore } from "react";
import { newErrorCode } from "../../core/error-code";
import { APP_VERSION } from "../../core/version";
import { ApiError, NetworkError } from "../api";

/** What failed, as the notice tells it. */
export type ErrorKind = "load" | "save" | "offline" | "app";

export type ErrorNotice = {
  code: string;
  at: string;
  kind: ErrorKind;
  action: string;
  message: string;
  appVersion: string;
};

type LoggedError = Omit<ErrorNotice, "kind">;

const QUEUE_KEY = "errorQueue";
/** A device that stays offline for long keeps only its latest errors. */
const QUEUE_LIMIT = 50;

let notices: ErrorNotice[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useErrorNotices() {
  return useSyncExternalStore(subscribe, () => notices);
}

export function dismissNotice(code: string) {
  notices = notices.filter((n) => n.code !== code);
  emit();
}

function readQueue(): LoggedError[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LoggedError[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: LoggedError[]) {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_LIMIT)));
  } catch {
    // Without storage the error is only shown, not logged later.
  }
}

let flushing: Promise<void> | null = null;

async function sendQueued() {
  // Errors queued while this runs are sent too.
  for (let error = readQueue()[0]; error; error = readQueue()[0]) {
    let res: Response;
    try {
      res = await fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(error),
      });
    } catch {
      return; // still offline
    }
    // Logged, or refused for good (signed out, invalid): either way it leaves the queue.
    if (res.status >= 500) return;
    const sent = error.code;
    writeQueue(readQueue().filter((e) => e.code !== sent));
  }
}

/** Sends the errors this device kept while offline; stops at the first one that can't go. */
export function flushErrorQueue(): Promise<void> {
  flushing ??= sendQueued().finally(() => {
    flushing = null;
  });
  return flushing;
}

function describe(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 1000);
  return String(error).slice(0, 1000);
}

/**
 * Shows a failure at once and logs it. Answers the screen handles itself (a wrong password,
 * a validation error) are not failures; server errors, lost connections and crashes are.
 */
export function reportFailure(error: unknown, kind: "load" | "save" | "app", action = "") {
  if (error instanceof ApiError && error.status < 500) return;
  const isOffline = error instanceof NetworkError;
  const notice: ErrorNotice = {
    // The Worker already logged its own failures and says under which code.
    code: error instanceof ApiError && error.body.code ? error.body.code : newErrorCode(),
    at: new Date().toISOString(),
    kind: isOffline ? "offline" : kind,
    action: (error instanceof ApiError || isOffline ? error.action : action).slice(0, 200),
    message: describe(error),
    appVersion: APP_VERSION,
  };
  // A failure that keeps repeating shows once.
  if (notices.some((n) => n.action === notice.action && n.message === notice.message)) return;
  notices = [...notices, notice];
  emit();
  if (error instanceof ApiError && error.body.code) return;
  writeQueue([
    ...readQueue(),
    {
      code: notice.code,
      at: notice.at,
      action: notice.action,
      message: notice.message,
      appVersion: notice.appVersion,
    },
  ]);
  void flushErrorQueue();
}

/** Report: emails the recovery address with the error's details and an optional comment. */
export async function sendReport(code: string, comment: string) {
  await flushErrorQueue();
  const res = await fetch(`/api/errors/${code}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
}

/** Catches crashes outside React Query, and sends queued errors once back online. */
export function watchForErrors() {
  window.addEventListener("error", (event) =>
    reportFailure(event.error ?? event.message, "app", "window"),
  );
  window.addEventListener("unhandledrejection", (event) =>
    reportFailure(event.reason, "app", "promise"),
  );
  window.addEventListener("online", () => void flushErrorQueue());
  void flushErrorQueue();
}
