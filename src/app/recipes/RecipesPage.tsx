import { BookOpenText, Plus, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { todayIn } from "../../core/plain-date";
import { searchRecipes, type Recipe } from "../../core/recipe";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { PlanSwitch } from "../meals/PlanSwitch";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { BUTTON_PRIMARY } from "../ui/button";
import { useRecipes, useTagLabel } from "./model";

/** The Family's Recipe Book: searched by name, tag or ingredient, narrowed to one tag. */
export function RecipesPage() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone, useNow(60_000));
  const recipes = useRecipes();
  const label = useTagLabel();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState("");
  const all = recipes.data;
  const tags = [...new Set((all ?? []).flatMap((r) => r.tags))].sort((a, b) =>
    label(a).localeCompare(label(b)),
  );
  // A tag no recipe has any more is no longer a filter.
  const tag = tags.includes(chosen) ? chosen : "";
  const shown = all ? searchRecipes(all, query, tag || undefined, label) : [];

  return (
    <>
      <ViewNav date={today} title={t("recipes.title")} />
      <main
        className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-24"
        data-testid="recipes"
      >
        <PlanSwitch current="recipes" />
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("recipes.search")}
            placeholder={t("recipes.searchHint")}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
          <Link to={paths.newRecipe()} className={`${BUTTON_PRIMARY} shrink-0`}>
            <Plus aria-hidden size={16} />
            {t("recipes.new")}
          </Link>
        </div>
        {tags.length > 0 && (
          <div role="group" aria-label={t("recipes.filterTags")} className="flex flex-wrap gap-2">
            {["", ...tags].map((tg) => (
              <button
                key={tg || "all"}
                type="button"
                aria-pressed={tg === tag}
                onClick={() => setChosen(tg)}
                className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                  tg === tag
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface hover:border-accent"
                }`}
              >
                {tg ? label(tg) : t("recipes.allTags")}
              </button>
            ))}
          </div>
        )}
        {all && all.length === 0 && (
          <div className="flex flex-col gap-1 py-6 text-center">
            <p className="font-medium">{t("recipes.empty")}</p>
            <p className="text-sm text-muted">{t("recipes.emptyHint")}</p>
          </div>
        )}
        {all && all.length > 0 && shown.length === 0 && (
          <p className="text-muted">{t("recipes.noMatch")}</p>
        )}
        <ul className="flex flex-col gap-2">
          {shown.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      </main>
    </>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation();
  const label = useTagLabel();
  return (
    <li>
      <Link
        to={paths.recipe(recipe.id)}
        data-testid="recipe-card"
        className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2 hover:border-accent"
      >
        {recipe.photoKey ? (
          <img
            src={`/api/images/${recipe.photoKey}`}
            alt=""
            className="size-16 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-md bg-line/50 text-muted"
          >
            <BookOpenText size={24} strokeWidth={1.5} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="min-w-0 truncate">{recipe.name}</span>
            {recipe.favourite && (
              <Star
                role="img"
                aria-label={t("recipes.favourite")}
                size={16}
                className="shrink-0 fill-current text-accent"
              />
            )}
          </span>
          {(recipe.minutes !== null || recipe.tags.length > 0) && (
            <span className="truncate text-sm text-muted">
              {[
                recipe.minutes !== null ? t("recipes.minutes", { count: recipe.minutes }) : "",
                ...recipe.tags.map(label),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
