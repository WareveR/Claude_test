import { BookOpenText, ListPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router";
import { formatLocale } from "../../core/languages";
import { MEAL_SLOTS, weekOf, type MealSlot } from "../../core/meal-plan";
import { shoppingDates, shoppingFromMeals, type MealShoppingLine } from "../../core/meal-shopping";
import {
  addDays,
  formatPlainDate,
  isoWeek,
  isPlainDate,
  todayIn,
  type PlainDate,
} from "../../core/plain-date";
import { TODAY_PILL, TODAY_TINT } from "../calendar/today";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { useRecipes } from "../recipes/model";
import { refreshShopping, useShoppingItems } from "../shopping/model";
import { BUTTON } from "../ui/button";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { MealDialog } from "./MealDialog";
import { MealShoppingDialog } from "./MealShoppingDialog";
import { addMealLines, useMeals, type Meal } from "./model";
import { PlanSwitch } from "./PlanSwitch";

/** The weekly meal plan: any date in the address shows its Monday to Sunday week. */
export function MealPlanPage() {
  const { date = "" } = useParams();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone, useNow(60_000));
  if (!isPlainDate(date)) return <Navigate to={paths.meals(today)} replace />;
  return <Plan date={date} today={today} />;
}

function Plan({ date, today }: { date: PlainDate; today: PlainDate }) {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const locale = formatLocale(language);
  const days = weekOf(date);
  const monday = days[0];
  const meals = useMeals(monday, days[6]).data ?? [];
  // The slot being planned; the dialog opens over the week.
  const [editing, setEditing] = useState<{ date: PlainDate; slot: MealSlot } | null>(null);
  const { week, year } = isoWeek(monday);

  // The Meals to buy for: from today in the current week, else the whole week.
  const queryClient = useQueryClient();
  const recipes = useRecipes().data;
  const openItems = useShoppingItems().data;
  const buyDates = shoppingDates(days, today);
  const lines = shoppingFromMeals(
    meals.filter((m) => buyDates.includes(m.date)),
    recipes ?? [],
    openItems ?? [],
    language,
  );
  const [shopping, setShopping] = useState(false);
  const [done, setDone] = useState<{ undo: () => Promise<void> } | null>(null);
  const [undone, setUndone] = useState(false);
  useEffect(() => {
    if (!done && !undone) return;
    const timer = setTimeout(() => {
      setDone(null);
      setUndone(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [done, undone]);
  const period = `${formatPlainDate(buyDates[0], locale, { day: "numeric", month: "short" })} – ${formatPlainDate(buyDates[buyDates.length - 1], locale, { day: "numeric", month: "short" })}`;
  const addToShopping = async (chosen: MealShoppingLine[]) => {
    const undo = await addMealLines(chosen, language).finally(() => refreshShopping(queryClient));
    setShopping(false);
    setUndone(false);
    setDone({
      undo: async () => {
        try {
          await undo();
        } finally {
          await refreshShopping(queryClient);
        }
      },
    });
  };
  const undoShopping = async () => {
    if (!done) return;
    const { undo } = done;
    setDone(null);
    await undo();
    setUndone(true);
  };
  return (
    <>
      <ViewNav
        date={monday}
        title={t("views.weekTitle", { week, year })}
        shortTitle={t("views.weekShort", { week, year })}
        previous={paths.meals(addDays(monday, -7))}
        next={paths.meals(addDays(monday, 7))}
      />
      <main
        className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pb-24 max-sm:px-2"
        data-testid="meal-plan"
        aria-label={t("meals.title")}
      >
        <PlanSwitch current="meals" />
        <div className="flex">
          <button
            type="button"
            className={BUTTON}
            // Until the open items are in, every line would look new and be added twice.
            disabled={lines.length === 0 || !recipes || !openItems}
            data-testid="meal-shopping-button"
            onClick={() => setShopping(true)}
          >
            <ListPlus aria-hidden size={16} />
            {t("meals.shop.button")}
          </button>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
          {days.map((day) => (
            <li
              key={day}
              data-testid={`meal-day-${day}`}
              data-today={day === today || undefined}
              className={`flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-2 ${day === today ? TODAY_TINT : ""}`}
            >
              <h2 className="flex items-baseline justify-between gap-2 text-sm font-semibold first-letter:uppercase">
                <span>
                  {formatPlainDate(day, locale, { weekday: "long" }).replace(/-feira$/, "")}
                </span>
                <span className={`font-normal ${day === today ? `${TODAY_PILL}` : "text-muted"}`}>
                  {formatPlainDate(day, locale, { day: "numeric", month: "short" })}
                </span>
              </h2>
              {MEAL_SLOTS.map((slot) => (
                <Slot
                  key={slot}
                  slot={slot}
                  meal={meals.find((m) => m.date === day && m.slot === slot)}
                  onOpen={() => setEditing({ date: day, slot })}
                />
              ))}
            </li>
          ))}
        </ul>
      </main>
      {shopping && (
        <MealShoppingDialog
          period={period}
          lines={lines}
          onAdd={addToShopping}
          onClose={() => setShopping(false)}
        />
      )}
      {(done || undone) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
          <div
            role="status"
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm shadow-lg"
          >
            <span>{t(done ? "meals.shop.done" : "meals.shop.undone")}</span>
            {done && (
              <>
                <button type="button" className={BUTTON} onClick={() => void undoShopping()}>
                  {t("meals.shop.undo")}
                </button>
                <Link to={paths.shopping()} className={BUTTON}>
                  {t("meals.shop.open")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      {editing && (
        <MealDialog
          key={`${editing.date}-${editing.slot}`}
          date={editing.date}
          slot={editing.slot}
          meal={meals.find((m) => m.date === editing.date && m.slot === editing.slot)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function Slot({
  slot,
  meal,
  onOpen,
}: {
  slot: MealSlot;
  meal: Meal | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-stretch gap-1" data-testid={`meal-slot-${slot}`}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-line/60 px-2 py-1 text-left hover:border-accent"
      >
        <span className="w-14 shrink-0 text-xs text-muted">{t(`meals.slots.${slot}`)}</span>
        {meal ? (
          <span className="min-w-0 flex-1 break-words">
            {meal.text}
            {meal.servings !== null && (
              <span className="ml-1.5 text-xs text-muted">
                {t("meals.servingsCount", { count: meal.servings })}
              </span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-muted/60">
            <Plus aria-hidden size={14} />
            {t("meals.add")}
          </span>
        )}
      </button>
      {meal?.recipeId && (
        <Link
          to={paths.recipe(meal.recipeId)}
          aria-label={t("meals.openRecipe", { name: meal.text })}
          className="flex w-9 shrink-0 items-center justify-center rounded-md border border-line/60 text-muted hover:border-accent hover:text-ink"
        >
          <BookOpenText aria-hidden size={16} />
        </Link>
      )}
    </div>
  );
}
