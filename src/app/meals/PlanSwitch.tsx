import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { useNow } from "../shell/useNow";

/** At the top of the Meal plan and the Recipe Book: one button for each, to move between them. */
export function PlanSwitch({ current }: { current: "meals" | "recipes" }) {
  const { t } = useTranslation();
  const today = todayIn(useSignedIn().family.timeZone, useNow(60_000));
  const item = (which: "meals" | "recipes", to: string, label: string) => (
    <Link
      to={to}
      aria-current={current === which ? "page" : undefined}
      className={`flex-1 px-3 py-1.5 text-center text-sm font-medium ${
        current === which ? "bg-accent text-accent-ink" : "bg-surface hover:bg-line/60"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div
      data-testid="plan-switch"
      className="flex w-full max-w-xs shrink-0 overflow-hidden rounded-md border border-line"
    >
      {item("meals", paths.meals(today), t("meals.switchPlan"))}
      {item("recipes", paths.recipes(), t("meals.switchRecipes"))}
    </div>
  );
}
