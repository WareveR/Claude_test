import { Minus, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { todayIn } from "../../core/plain-date";
import { formatIngredient, stepLines, type Recipe } from "../../core/recipe";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { useNow } from "../shell/useNow";
import { ViewNav } from "../shell/ViewNav";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { useChangeRecipe, useDeleteRecipe, useRecipes, useTagLabel } from "./model";

/** One Recipe to cook from, its quantities scaled to the servings shown. */
export function RecipePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone, useNow(60_000));
  const recipes = useRecipes();
  const recipe = recipes.data?.find((r) => r.id === id);
  return (
    <>
      <ViewNav date={today} title={t("recipes.title")} />
      {recipe ? (
        <RecipeView key={recipe.id} recipe={recipe} />
      ) : (
        recipes.data && (
          <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-24">
            <p className="text-muted">{t("recipes.notFound")}</p>
            <Link to={paths.recipes()} className={`${BUTTON} self-start`}>
              {t("recipes.back")}
            </Link>
          </main>
        )
      )}
    </>
  );
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const change = useChangeRecipe();
  const remove = useDeleteRecipe();
  const label = useTagLabel();
  // Only the view is scaled; the Recipe keeps its own servings.
  const [shown, setShown] = useState(recipe.servings);
  const factor = shown / recipe.servings;
  const steps = stepLines(recipe.steps);
  const link = /^https?:\/\//i.test(recipe.source.trim());

  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-24"
      data-testid="recipe-page"
    >
      {recipe.photoKey && (
        <img
          src={`/api/images/${recipe.photoKey}`}
          alt=""
          className="max-h-72 w-full rounded-lg object-cover"
        />
      )}
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 flex-1 text-xl font-semibold break-words">{recipe.name}</h1>
        <button
          type="button"
          aria-pressed={recipe.favourite}
          aria-label={recipe.favourite ? t("recipes.unfavourite") : t("recipes.favourite")}
          onClick={() => change.mutate({ id: recipe.id, change: { favourite: !recipe.favourite } })}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface"
        >
          <Star
            aria-hidden
            size={20}
            className={recipe.favourite ? "fill-current text-accent" : ""}
          />
        </button>
      </div>
      {(recipe.minutes !== null || recipe.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {recipe.minutes !== null && (
            <span>{t("recipes.minutes", { count: recipe.minutes })}</span>
          )}
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2.5 py-0.5">
              {label(tag)}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2" role="group" aria-label={t("recipes.servings")}>
        <button
          type="button"
          aria-label={t("recipes.fewer")}
          disabled={shown <= 1}
          onClick={() => setShown(shown - 1)}
          className="flex size-10 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-50"
        >
          <Minus aria-hidden size={18} />
        </button>
        <span className="min-w-24 text-center font-medium" aria-live="polite">
          {t("recipes.servingsShown", { count: shown })}
        </span>
        <button
          type="button"
          aria-label={t("recipes.more")}
          disabled={shown >= 50}
          onClick={() => setShown(shown + 1)}
          className="flex size-10 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-50"
        >
          <Plus aria-hidden size={18} />
        </button>
      </div>
      {recipe.ingredients.length > 0 && (
        <section aria-label={t("recipes.ingredients")}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t("recipes.ingredients")}
          </h2>
          <ul className="divide-y divide-line">
            {recipe.ingredients.map((ing, i) => (
              <li
                key={i}
                data-testid="recipe-ingredient"
                className={`flex items-baseline justify-between gap-2 py-1.5 ${ing.pantry ? "text-muted" : ""}`}
              >
                <span>{formatIngredient(ing, factor, i18n.language)}</span>
                {ing.pantry && (
                  <span className="shrink-0 text-xs tracking-wide uppercase">
                    {t("recipes.pantry")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {steps.length > 0 && (
        <section aria-label={t("recipes.steps")}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t("recipes.steps")}
          </h2>
          <ol className="flex flex-col gap-2 pt-1">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-medium">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {recipe.source.trim() && (
        <section aria-label={t("recipes.source")}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t("recipes.source")}
          </h2>
          {link ? (
            <a
              href={recipe.source.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent underline"
            >
              {recipe.source.trim()}
            </a>
          ) : (
            <p className="break-words">{recipe.source}</p>
          )}
        </section>
      )}
      {recipe.notes.trim() && (
        <section aria-label={t("recipes.notes")}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t("recipes.notes")}
          </h2>
          <p className="break-words whitespace-pre-wrap">{recipe.notes}</p>
        </section>
      )}
      <div className="flex gap-2">
        <Link to={paths.editRecipe(recipe.id)} className={BUTTON}>
          <Pencil aria-hidden size={16} />
          {t("recipes.edit")}
        </Link>
        <button
          type="button"
          className={BUTTON_DANGER}
          disabled={remove.isPending}
          onClick={() => {
            if (!window.confirm(t("recipes.confirmDelete", { name: recipe.name }))) return;
            remove.mutate(recipe.id, { onSuccess: () => navigate(paths.recipes()) });
          }}
        >
          <Trash2 aria-hidden size={16} />
          {t("recipes.delete")}
        </button>
      </div>
    </main>
  );
}
