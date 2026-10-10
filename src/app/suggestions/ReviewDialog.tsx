import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { RepetitionFields } from "../entries/RepetitionFields";
import { useSignedIn } from "../family";
import { Field } from "../screens/form";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { describeItem, type Edit, type Item } from "./model";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

/**
 * Everything about to be created, soonest first. Each one's first date, time and Repetition can be
 * changed here ("every week" to "every month"); nothing is saved until "Create".
 */
export function ReviewDialog({
  items,
  busy,
  error,
  onEdit,
  onCreate,
  onClose,
}: {
  items: Item[];
  busy: boolean;
  error: string | null;
  onEdit: (key: string, edit: Edit) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-2xl bg-frame sm:rounded-2xl"
      >
        <div className="flex flex-col gap-1 p-4 pb-2">
          <h2 id="review-title" className="text-lg font-semibold">
            {t("suggestions.reviewTitle", { count: items.length })}
          </h2>
          <p className="text-sm text-muted">{t("suggestions.reviewHint")}</p>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-y border-line">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-3 px-4 py-2">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    item.debit ? "bg-holiday text-holiday-ink" : "bg-weekend text-weekend-ink"
                  }`}
                >
                  {t(`suggestions.kinds.${item.debit ? "debit" : item.kind}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted">{describeItem(item, t, locale)}</div>
                </div>
                <button
                  type="button"
                  className={BUTTON}
                  aria-expanded={open === item.key}
                  aria-label={
                    open === item.key ? undefined : t("suggestions.change", { title: item.title })
                  }
                  onClick={() => setOpen(open === item.key ? null : item.key)}
                >
                  {open === item.key ? t("suggestions.done") : t("suggestions.changeShort")}
                </button>
              </div>
              {open === item.key && (
                <div className="flex flex-col gap-3 rounded-lg bg-surface p-3">
                  <Field label={t("suggestions.firstDate")}>
                    <input
                      type="date"
                      className={INPUT}
                      value={item.date}
                      onChange={(e) => e.target.value && onEdit(item.key, { date: e.target.value })}
                    />
                  </Field>
                  {!item.debit && (
                    <Field label={t("suggestions.time")}>
                      <input
                        type="time"
                        className={INPUT}
                        value={item.time ?? ""}
                        onChange={(e) => onEdit(item.key, { time: e.target.value || null })}
                      />
                    </Field>
                  )}
                  <RepetitionFields
                    value={item.repetition}
                    start={item.date}
                    onChange={(repetition) => onEdit(item.key, { repetition })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="px-4 pt-2 text-sm text-overdue">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 p-4">
          <button type="button" className={BUTTON} onClick={onClose} disabled={busy}>
            {t("suggestions.back")}
          </button>
          <button
            type="button"
            className={BUTTON_PRIMARY}
            onClick={onCreate}
            disabled={busy || items.length === 0}
          >
            {busy ? t("suggestions.creating") : t("suggestions.create", { count: items.length })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
