import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { RepetitionFields } from "../entries/RepetitionFields";
import { useSignedIn } from "../family";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { Field } from "../screens/form";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { Chip } from "../ui/Toggle";
import { describeItem, type Edit, type Item } from "./model";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

/**
 * Everything about to be created, soonest first. Each one's first date, time, Repetition and
 * Persons can be changed here ("every week" to "every month"), and a line can be copied for
 * another Person to give them their own day and time; nothing is saved until "Create".
 */
export function ReviewDialog({
  items,
  persons,
  shopping,
  busy,
  error,
  onEdit,
  onCopy,
  onRemoveCopy,
  onCreate,
  onClose,
}: {
  items: Item[];
  /** The Persons a line can be for; none means the whole Family. */
  persons: Person[];
  /** Names to put on the Shopping List. */
  shopping: string[];
  busy: boolean;
  error: string | null;
  onEdit: (key: string, edit: Edit) => void;
  /** Adds a copy of the line for this Person. */
  onCopy: (key: string, personId: string) => void;
  onRemoveCopy: (key: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const [open, setOpen] = useState<string | null>(null);
  // The order stays as it opened: a changed date never moves a line from under the finger (on a
  // phone, a line moved while its date picker is open loses the date picked).
  const [order] = useState(() => items.map((item) => item.key));
  const place = (key: string) => {
    const i = order.indexOf(key);
    if (i !== -1) return i;
    // A copy made here sits right under the line it copies.
    const base = order.indexOf(key.replace(/\+\d+$/, ""));
    return base === -1 ? order.length : base + 0.5;
  };
  const count = items.length + shopping.length;
  const forWhom = (item: Item) =>
    item.personIds.length === 0
      ? t("suggestions.family")
      : persons
          .filter((p) => item.personIds.includes(p.id))
          .map((p) => p.name)
          .join(", ");
  const shown = [...items].sort((a, b) => place(a.key) - place(b.key));

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
            {t("suggestions.reviewTitle", { count })}
          </h2>
          <p className="text-sm text-muted">{t("suggestions.reviewHint")}</p>
          {shopping.length > 0 && (
            <p data-testid="review-shopping" className="font-medium">
              {t("shopping.addFromText", { names: shopping.join(", ") })}
            </p>
          )}
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-y border-line">
          {shown.map((item) => (
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
                  {persons.length > 0 && (
                    <div className="text-sm text-muted" data-testid="review-for">
                      {t("suggestions.for", { who: forWhom(item) })}
                    </div>
                  )}
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
                  {persons.length > 0 && (
                    <fieldset className="flex flex-col gap-1 text-sm">
                      <legend className="mb-1 font-medium">{t("suggestions.forWhom")}</legend>
                      <div className="flex flex-wrap gap-2">
                        {persons.map((p) => (
                          <Chip
                            key={p.id}
                            checked={item.personIds.includes(p.id)}
                            onChange={(e) =>
                              onEdit(item.key, {
                                personIds: e.target.checked
                                  ? [...item.personIds, p.id]
                                  : item.personIds.filter((id) => id !== p.id),
                              })
                            }
                          >
                            <PersonAvatar person={p} size={20} />
                            {p.name}
                          </Chip>
                        ))}
                      </div>
                      <p className="text-xs text-muted">{t("suggestions.togetherHint")}</p>
                    </fieldset>
                  )}
                  {persons.length > 0 && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label={t("suggestions.alsoFor")}>
                        <select
                          className={INPUT}
                          value=""
                          onChange={(e) => e.target.value && onCopy(item.key, e.target.value)}
                        >
                          <option value="">{t("suggestions.alsoForPick")}</option>
                          {persons.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {/\+\d+$/.test(item.key) && (
                        <button
                          type="button"
                          className={BUTTON_DANGER}
                          onClick={() => {
                            setOpen(null);
                            onRemoveCopy(item.key);
                          }}
                        >
                          {t("suggestions.removeCopy")}
                        </button>
                      )}
                    </div>
                  )}
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
            disabled={busy || count === 0}
          >
            {busy ? t("suggestions.creating") : t("suggestions.create", { count })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
