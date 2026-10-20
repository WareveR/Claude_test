import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON } from "../ui/button";

type Copyable = {
  code: string;
  action: string;
  /** Already written in the reader's language and time zone. */
  time: string;
  appVersion: string;
  message: string;
  comment?: string | null;
};

/** One failure as plain text, labelled as on screen, to paste into a message. */
export function errorText(
  error: Copyable,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return [
    error.code,
    `${t("errors.action")}: ${error.action || "—"}`,
    `${t("errors.time")}: ${error.time}`,
    `${t("errors.version")}: ${error.appVersion}`,
    `${t("errors.message")}: ${error.message}`,
    ...(error.comment ? [t("errors.log.comment", { comment: error.comment })] : []),
  ].join("\n");
}

/** Copies a failure's details, and says so for a moment. */
export function CopyError({ error }: { error: Copyable }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(errorText(error, t));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an old browser, or permission refused): the details stay on screen to read.
    }
  }
  return (
    <button type="button" className={BUTTON} onClick={() => void copy()}>
      {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      {t(copied ? "errors.copied" : "errors.copy")}
    </button>
  );
}
