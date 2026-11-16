import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { lastPlanned, rankForPicker, type Meal, type MealSlot } from "../../core/meal-plan";
import { addDays, formatPlainDate, type PlainDate } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { useRecipes, useTagLabel } from "../recipes/model";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { useMeals, useRemoveMeal, useSetMeal } from "./model";

/** Days of the plan read each side of the day, to say when each Recipe was planned last. */
const HISTORY_DAYS = 30;
const MAX_SHOWN = 40;

/**
 * Plans one slot: a Recipe from the Recipe Book (the ones not planned for longest first) or free
 * text, with the servings. Saving or removing shows at once and closes the dialog.
 */
export function MealDialog({
  date,
  slot,
  meal,
  onClose,
}: {
  date: PlainDate;
  slot: MealSlot;
  meal: Meal | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const locale = formatLocale(language);
  const label = useTagLabel();
  const titleId = useId();
  const recipes = useRecipes().data ?? [];
  const around = useMeals(addDays(date, -HISTORY_DAYS), addDays(date, HISTORY_DAYS)).data ?? [];
  // The slot being changed does not count: its own Recipe is not "planned" by itself.
  const others = around.filter((m) => !(m.date === date && m.slot === slot));
  const last = lastPlanned(others);
  const set = useSetMeal();
  const remove = useRemoveMeal();

  const [query, setQuery] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>(meal?.recipeId ?? null);
  const [text, setText] = useState(meal && !meal.recipeId ? meal.text : "");
  const [servings, setServings] = useState<number | null>(meal?.servings ?? null);
  const chosen = recipes.find((r) => r.id === recipeId);
  const shown = rankForPicker(recipes, others, query, label).slice(0, MAX_SHOWN);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const day = formatPlainDate(date, locale, { weekday: "long", day: "numeric", month: "long" });
  const hint = (id: string) => {
    const when = last.get(id);
    return when
      ? t("meals.last", {
          date: formatPlainDate(when, locale, { day: "numeric", month: "short" }),
        })
      : t("meals.never");
  };
  const choose = (id: string, recipeServings: number) => {
    setRecipeId(id);
    setText("");
    setServings(recipeServings);
  };
  const free = text.trim();
  const canSave = chosen !== undefined || free !== "";
  const save = () => {
    if (!canSave) return;
    set.mutate({
      date,
      slot,
      recipeId: chosen?.id ?? null,
      text: chosen?.name ?? free,
      servings,
    });
    onClose();
  };
  const field = "w-full rounded-md border border-line bg-surface px-3 py-2 text-base";

  // On the body: the header's stacking would otherwise trap this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="meal-dialog"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold first-letter:uppercase">
          {t("meals.editTitle", { slot: t(`meals.slots.${slot}`), day })}
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("meals.search")}
          placeholder={t("recipes.searchHint")}
          className={field}
        />
        <ul
          aria-label={t("meals.recipe")}
          className="flex max-h-44 flex-col overflow-y-auto rounded-md border border-line bg-surface"
        >
          {shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{t("meals.noRecipes")}</li>
          )}
          {shown.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-pressed={r.id === recipeId}
                onClick={() => choose(r.id, r.servings)}
                className={`flex min-h-11 w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left ${
                  r.id === recipeId ? "bg-accent text-accent-ink" : "hover:bg-line/60"
                }`}
              >
                <span className="min-w-0 break-words">{r.name}</span>
                <span
                  className={`shrink-0 text-xs ${r.id === recipeId ? "" : "text-muted"}`}
                  data-testid="meal-hint"
                >
                  {hint(r.id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("meals.text")}
          <input
            type="text"
            value={text}
            maxLength={200}
            placeholder={t("meals.textHint")}
            onChange={(e) => {
              setText(e.target.value);
              setRecipeId(null);
            }}
            className={`${field} font-normal`}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["leftovers", "eatingOut"] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setText(t(`meals.chips.${chip}`));
                setRecipeId(null);
              }}
              className="min-h-9 rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-accent"
            >
              {t(`meals.chips.${chip}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t("meals.servings")}>
          <button
            type="button"
            aria-label={t("meals.fewer")}
            disabled={servings === null}
            onClick={() => setServings(servings !== null && servings > 1 ? servings - 1 : null)}
            className="flex size-10 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-50"
          >
            <Minus aria-hidden size={18} />
          </button>
          <span className="min-w-28 text-center font-medium" aria-live="polite">
            {servings === null
              ? t("meals.noServings")
              : t("meals.servingsCount", { count: servings })}
          </span>
          <button
            type="button"
            aria-label={t("meals.more")}
            disabled={servings !== null && servings >= 50}
            onClick={() => setServings(servings === null ? (chosen?.servings ?? 4) : servings + 1)}
            className="flex size-10 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-50"
          >
            <Plus aria-hidden size={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {meal && (
            <button
              type="button"
              className={`${BUTTON_DANGER} mr-auto`}
              onClick={() => {
                remove.mutate({ date, slot });
                onClose();
              }}
            >
              {t("meals.remove")}
            </button>
          )}
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="button" className={BUTTON_PRIMARY} disabled={!canSave} onClick={save}>
            {t("meals.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
