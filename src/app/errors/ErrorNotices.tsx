import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api";
import { dismissNotice, sendReport, useErrorNotices, type ErrorNotice } from "./store";

/** Failures, shown at once over every screen until dismissed. */
export function ErrorNotices() {
  const notices = useErrorNotices();
  if (notices.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3">
      {notices.slice(-3).map((notice) => (
        <Notice key={notice.code} notice={notice} />
      ))}
    </div>
  );
}

type ReportState = "closed" | "open" | "sending" | "sent" | "failed" | "tooMany";

function Notice({ notice }: { notice: ErrorNotice }) {
  const { t, i18n } = useTranslation();
  const [details, setDetails] = useState(false);
  const [report, setReport] = useState<ReportState>("closed");
  const [comment, setComment] = useState("");

  async function send() {
    setReport("sending");
    try {
      await sendReport(notice.code, comment);
      setReport("sent");
    } catch (error) {
      setReport(error instanceof ApiError && error.status === 429 ? "tooMany" : "failed");
    }
  }

  return (
    <div
      role="alert"
      className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg"
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <p className="font-medium text-overdue">{t(`errors.notice.${notice.kind}`)}</p>
          <p>{t(notice.kind === "offline" ? "errors.tryOffline" : "errors.tryAgain")}</p>
          <p className="font-mono text-xs text-muted">{notice.code}</p>
        </div>
        <button
          type="button"
          aria-label={t("errors.dismiss")}
          className="rounded-md p-1 hover:bg-line/60"
          onClick={() => dismissNotice(notice.code)}
        >
          <X size={16} />
        </button>
      </div>

      {details && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted">{t("errors.action")}</dt>
          <dd className="break-all">{notice.action || "—"}</dd>
          <dt className="text-muted">{t("errors.time")}</dt>
          <dd>
            {new Date(notice.at).toLocaleString(i18n.language, {
              dateStyle: "short",
              timeStyle: "medium",
            })}
          </dd>
          <dt className="text-muted">{t("errors.version")}</dt>
          <dd>{notice.appVersion}</dd>
          <dt className="text-muted">{t("errors.message")}</dt>
          <dd className="break-all">{notice.message}</dd>
        </dl>
      )}

      {report === "open" || report === "sending" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="flex flex-col gap-1 text-xs">
            {t("errors.reportComment")}
            <textarea
              className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
              rows={2}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={report === "sending"}
            className="self-start rounded-md bg-accent px-3 py-1 text-accent-ink disabled:opacity-50"
          >
            {t("errors.send")}
          </button>
        </form>
      ) : (
        <div className="flex gap-4 text-xs">
          <button type="button" className="underline" onClick={() => setDetails(!details)}>
            {t(details ? "errors.hideDetails" : "errors.seeDetails")}
          </button>
          {report === "sent" ? (
            <span>{t("errors.reported")}</span>
          ) : (
            <button type="button" className="underline" onClick={() => setReport("open")}>
              {t("errors.report")}
            </button>
          )}
        </div>
      )}
      {report === "failed" && <p className="text-xs text-overdue">{t("errors.reportFailed")}</p>}
      {report === "tooMany" && <p className="text-xs text-overdue">{t("errors.tooManyReports")}</p>}
    </div>
  );
}
