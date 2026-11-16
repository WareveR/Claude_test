import { BookOpenText, Plus, X } from "lucide-react";
import { useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import {
  DEFAULT_TAGS,
  fold,
  formatIngredient,
  parseIngredient,
  type Ingredient,
  type Recipe,
} from "../../core/recipe";
import { readyToEdit } from "../offline/fresh";
import { uploadPhoto } from "../persons/model";
import { paths } from "../paths";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { BUTTON } from "../ui/button";
import { useRecipes, useSaveRecipe, useTagLabel } from "./model";

/** Adding a Recipe, or changing one. */
export function RecipeFormPage() {
  const { id } = useParams();
  const recipes = useRecipes();
  if (id && !readyToEdit(recipes)) return null;
  const recipe = id ? recipes.data?.find((r) => r.id === id) : undefined;
  // An address with a Recipe that is gone starts a new one.
  return <RecipeForm key={recipe?.id ?? "new"} recipe={recipe} />;
}

/** An ingredient row: the text as typed, and what it was read as. */
type Row = { key: number; text: string; ing: Ingredient };

let nextKey = 1;

/** Lines of a pasted list, without bullets or numbering. */
function pastedLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const label = useTagLabel();
  const language = i18n.language;
  const row = (ing: Ingredient): Row => ({
    key: nextKey++,
    text: formatIngredient(ing, 1, language),
    ing,
  });
  const [form, setForm] = useState({
    name: recipe?.name ?? "",
    servings: String(recipe?.servings ?? 4),
    minutes: recipe?.minutes ? String(recipe.minutes) : "",
    steps: recipe?.steps ?? "",
    source: recipe?.source ?? "",
    notes: recipe?.notes ?? "",
    photoKey: recipe?.photoKey ?? null,
  });
  const [tags, setTags] = useState(recipe?.tags ?? []);
  const [rows, setRows] = useState(() => (recipe?.ingredients ?? []).map(row));
  const [newIngredient, setNewIngredient] = useState("");
  const [newTag, setNewTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const save = useSaveRecipe(recipe?.id);
  const back = (id?: string) => navigate(id ? paths.recipe(id) : paths.recipes());

  function addIngredients(lines: string[]) {
    const added = lines.map((l) => parseIngredient(l)).filter((i) => i.name);
    if (added.length > 0) setRows((rs) => [...rs, ...added.map(row)]);
  }

  function addFromBox() {
    addIngredients([newIngredient]);
    setNewIngredient("");
  }

  function pasteIngredients(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(text.trim())) return;
    e.preventDefault();
    addIngredients([newIngredient, ...pastedLines(text)].filter((l) => l.trim()));
    setNewIngredient("");
  }

  function editRow(key: number, text: string) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const ing = parseIngredient(text);
        // The staple switch is kept while the ingredient is the same, else guessed again.
        return {
          ...r,
          text,
          ing: { ...ing, pantry: ing.name === r.ing.name ? r.ing.pantry : ing.pantry },
        };
      }),
    );
  }

  function toggleTag(tag: string) {
    setTags((ts) => (ts.includes(tag) ? ts.filter((x) => x !== tag) : [...ts, tag]));
  }

  function addTag() {
    const typed = newTag.trim().slice(0, 40);
    setNewTag("");
    if (!typed) return;
    // A default tag's name in this language is that tag.
    const key = DEFAULT_TAGS.find((d) => fold(label(d)) === fold(typed) || d === fold(typed));
    const tag = key ?? typed;
    setTags((ts) => (ts.some((x) => fold(x) === fold(tag)) ? ts : [...ts, tag]));
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const photoKey = await uploadPhoto(file, 800);
      setForm((f) => ({ ...f, photoKey }));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    // What is still typed in the ingredient box is not lost.
    const typed = newIngredient.trim() ? [parseIngredient(newIngredient)] : [];
    save.mutate(
      {
        name: form.name.trim(),
        servings: Number(form.servings),
        minutes: form.minutes ? Number(form.minutes) : null,
        tags,
        ingredients: [...rows.map((r) => r.ing), ...typed].filter((i) => i.name.trim()),
        steps: form.steps,
        source: form.source.trim(),
        notes: form.notes,
        photoKey: form.photoKey,
        favourite: recipe?.favourite ?? false,
      },
      { onSuccess: (saved) => back(saved.id) },
    );
  }

  const chip =
    "flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent/10";
  const custom = tags.filter((tag) => !(DEFAULT_TAGS as readonly string[]).includes(tag));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">
        {recipe ? t("recipes.editTitle") : t("recipes.newTitle")}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {form.photoKey ? (
            <img
              src={`/api/images/${form.photoKey}`}
              alt=""
              className="size-20 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-md bg-line/50 text-muted"
            >
              <BookOpenText size={28} strokeWidth={1.5} />
            </span>
          )}
          <label className={`relative ${BUTTON}`}>
            {t("recipes.photo")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </label>
          {form.photoKey && (
            <button
              type="button"
              className={BUTTON}
              onClick={() => setForm({ ...form, photoKey: null })}
            >
              {t("recipes.removePhoto")}
            </button>
          )}
        </div>
        <Field label={t("recipes.name")}>
          <TextInput
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("recipes.servings")}>
            <TextInput
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={50}
              step={1}
              value={form.servings}
              onChange={(e) => setForm({ ...form, servings: e.target.value })}
            />
          </Field>
          <Field label={t("recipes.time")}>
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={2000}
              step={1}
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("recipes.tags")}</legend>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TAGS.map((tag) => (
              <label key={tag} className={chip}>
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                  className="sr-only"
                />
                {label(tag)}
              </label>
            ))}
            {custom.map((tag) => (
              <label key={tag} className={chip}>
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleTag(tag)}
                  className="sr-only"
                />
                {tag}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTag}
              maxLength={40}
              aria-label={t("recipes.addTag")}
              placeholder={t("recipes.addTag")}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addTag();
              }}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
            />
            <button type="button" className={BUTTON} onClick={addTag}>
              {t("recipes.addTagButton")}
            </button>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("recipes.ingredients")}</legend>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-2" data-testid="ingredient-row">
                <input
                  value={r.text}
                  maxLength={300}
                  aria-label={t("recipes.ingredient", { n: i + 1 })}
                  onChange={(e) => editRow(r.key, e.target.value)}
                  // A tidy line once typing stops.
                  onBlur={() =>
                    setRows((rs) =>
                      rs.map((x) =>
                        x.key === r.key ? { ...x, text: formatIngredient(x.ing, 1, language) } : x,
                      ),
                    )
                  }
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
                />
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted"
                  title={t("recipes.pantryHint")}
                >
                  <input
                    type="checkbox"
                    checked={r.ing.pantry}
                    aria-label={t("recipes.pantryOf", { name: r.ing.name })}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x) =>
                          x.key === r.key
                            ? { ...x, ing: { ...x.ing, pantry: e.target.checked } }
                            : x,
                        ),
                      )
                    }
                    className="size-4"
                  />
                  {t("recipes.pantry")}
                </label>
                <button
                  type="button"
                  aria-label={t("recipes.removeIngredient", { name: r.ing.name })}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line"
                >
                  <X aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newIngredient}
              maxLength={300}
              aria-label={t("recipes.addIngredient")}
              placeholder={t("recipes.addIngredientHint")}
              onChange={(e) => setNewIngredient(e.target.value)}
              onPaste={pasteIngredients}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addFromBox();
              }}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
            />
            <button
              type="button"
              aria-label={t("recipes.addIngredient")}
              className={BUTTON}
              onClick={addFromBox}
            >
              <Plus aria-hidden size={16} />
            </button>
          </div>
        </fieldset>
        <Field label={t("recipes.steps")}>
          <textarea
            rows={8}
            maxLength={20000}
            value={form.steps}
            placeholder={t("recipes.stepsHint")}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
        </Field>
        <Field label={t("recipes.source")}>
          <TextInput
            maxLength={500}
            value={form.source}
            placeholder={t("recipes.sourceHint")}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
        </Field>
        <Field label={t("recipes.notes")}>
          <textarea
            rows={4}
            maxLength={5000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
        </Field>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending || uploading}
          saveLabel={t("recipes.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => back(recipe?.id)}
        />
      </form>
    </main>
  );
}
