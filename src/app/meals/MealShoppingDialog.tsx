import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { MealShoppingLine } from "../../core/meal-shopping";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";

/**
 * The ingredients of the Meals to put on the Shopping List, each ticked to add; the staples
 * ("Pantry") wait unticked at the end. Confirming hands the ticked lines over; the dialog
 * stays open, with a message, when that fails.
 */
export function MealShoppingDialog({
  period,
  lines,
  onAdd,
  onClose,
}: {
  period: string;
  lines: MealShoppingLine[];
  onAdd: (lines: MealShoppingLine[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const isOn = (l: MealShoppingLine) => (l.pantry ? on.has(l.key) : !off.has(l.key));
  const chosen = lines.filter(isOn);
  const toggle = (l: MealShoppingLine) => {
    const set = l.pantry ? on : off;
    const next = new Set(set);
    if (!next.delete(l.key)) next.add(l.key);
    (l.pantry ? setOn : setOff)(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = async () => {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      await onAdd(chosen);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const buy = lines.filter((l) => !l.pantry);
  const pantry = lines.filter((l) => l.pantry);
  const row = (l: MealShoppingLine) => (
    <li key={l.key} className="border-b border-line last:border-b-0">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2">
        <input
          type="checkbox"
          checked={isOn(l)}
          onChange={() => toggle(l)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="break-words">
            <span className="font-medium">{l.name}</span>
            {l.quantity && <span className="ml-1.5">{l.quantity}</span>}
          </span>
          <span className="break-words text-xs text-muted">{l.recipes.join(", ")}</span>
          {l.existing && (
            <span className="break-words text-xs text-muted" data-testid="meal-shopping-existing">
              {t("meals.shop.existing", { quantity: l.existing.quantity || "✓" })}
            </span>
          )}
        </span>
      </label>
    </li>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="meal-shopping-dialog"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t("meals.shop.title", { period })}
        </h2>
        {buy.length > 0 && (
          <ul className="rounded-md border border-line bg-surface">{buy.map(row)}</ul>
        )}
        {pantry.length > 0 && (
          <section className="flex flex-col gap-1" aria-label={t("meals.shop.pantry")}>
            <h3 className="text-sm font-medium text-muted">{t("meals.shop.pantry")}</h3>
            <ul className="rounded-md border border-line bg-surface">{pantry.map(row)}</ul>
          </section>
        )}
        {failed && (
          <p role="alert" className="text-sm text-overdue">
            {t("meals.shop.failed")}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button
            type="button"
            className={BUTTON_PRIMARY}
            disabled={busy || chosen.length === 0}
            onClick={() => void add()}
          >
            {t("meals.shop.add", { count: chosen.length })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
