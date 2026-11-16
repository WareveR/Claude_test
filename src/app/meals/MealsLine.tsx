import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { MEAL_SLOTS, type Meal } from "../../core/meal-plan";
import type { PlainDate } from "../../core/plain-date";
import { paths } from "../paths";
import { useMeals } from "./model";

/** One discreet line, "Almoço: Bacalhau à Brás · Jantar: Restos", opening the meal plan of the day. */
export function MealsLine({
  day,
  meals,
  className = "",
}: {
  day: PlainDate;
  meals: Meal[];
  className?: string;
}) {
  const { t } = useTranslation();
  const planned = MEAL_SLOTS.flatMap((slot) => meals.filter((m) => m.slot === slot));
  if (planned.length === 0) return null;
  return (
    <Link
      to={paths.meals(day)}
      data-testid={`meals-line-${day}`}
      title={t("meals.line")}
      className={`block min-w-0 truncate text-xs font-normal text-muted hover:text-ink hover:underline ${className}`}
    >
      {planned.map((m) => `${t(`meals.slots.${m.slot}`)}: ${m.text}`).join(" · ")}
    </Link>
  );
}

/** The day's line, for a view that shows one day. */
export function DayMeals({ day, className }: { day: PlainDate; className?: string }) {
  const meals = useMeals(day, day).data ?? [];
  return <MealsLine day={day} meals={meals} className={className} />;
}
