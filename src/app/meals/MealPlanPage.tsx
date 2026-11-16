import { BookOpenText, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router";
import { formatLocale } from "../../core/languages";
import { MEAL_SLOTS, weekOf, type MealSlot } from "../../core/meal-plan";
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
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { MealDialog } from "./MealDialog";
import { useMeals, type Meal } from "./model";
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
