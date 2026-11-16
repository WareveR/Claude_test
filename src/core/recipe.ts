/** One ingredient of a Recipe. A null quantity is "q.b." (as much as needed). */
export interface Ingredient {
  quantity: number | null;
  unit: string;
  name: string;
  /** A staple most kitchens have: shown muted, never bought for the recipe. */
  pantry: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  /** Total time in minutes. */
  minutes: number | null;
  tags: string[];
  ingredients: Ingredient[];
  /** One step per line. */
  steps: string;
  /** A link or a book. */
  source: string;
  notes: string;
  photoKey: string | null;
  favourite: boolean;
  createdAt: string;
  changedAt: string;
}

/** Tags offered by default; each is a key translated as `recipes.tags.<key>`. */
export const DEFAULT_TAGS = [
  "soup",
  "fish",
  "meat",
  "vegetarian",
  "pasta",
  "dessert",
  "quick",
] as const;

/** Lower case without accents, to compare what people type. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Units written short; the others read as words and join the name with "de". */
const SHORT_UNITS = new Set(["g", "kg", "ml", "l", "dl", "cl", "tbsp", "tsp"]);

/** Unit words in English, joined to the name with "of"; the rest are Portuguese and take "de". */
const ENGLISH_UNITS = new Set(["cloves", "clove", "cups", "cup", "cans", "can", "pinch"]);

/** Known unit words, longest first so "colher de sopa" wins over "colher". */
const UNITS = [
  "colheres de sopa",
  "colher de sopa",
  "colheres de chá",
  "colher de chá",
  "colheres de café",
  "colher de café",
  "colheres de sobremesa",
  "colher de sobremesa",
  "colheres",
  "colher",
  "chávenas",
  "chávena",
  "embalagens",
  "embalagem",
  "unidades",
  "unidade",
  "pitadas",
  "pitada",
  "dentes",
  "dente",
  "molhos",
  "molho",
  "latas",
  "lata",
  "cloves",
  "clove",
  "cups",
  "cup",
  "cans",
  "can",
  "pinch",
  "tbsp",
  "tsp",
  "kg",
  "ml",
  "dl",
  "cl",
  "g",
  "l",
];

const ACCENTED: Record<string, string> = { á: "[áa]", é: "[ée]", í: "[íi]", ó: "[óo]", ú: "[úu]" };

const UNIT_PATTERNS = UNITS.map((unit) => ({
  unit,
  // A unit ends at a space or the end, so "l" is not the start of "laranjas".
  pattern: new RegExp(
    `^(?:${[...unit].map((ch) => (ch === " " ? "\\s+" : (ACCENTED[ch] ?? ch))).join("")})(?=\\s|$)`,
    "i",
  ),
}));

const GLYPHS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

/** The number at the start of the text (integer, decimal with comma or dot, fraction, ½) and the rest. */
function takeNumber(text: string): { value: number; rest: string } | null {
  const mixed = /^(\d+)\s*([½¼¾⅓⅔⅛])/.exec(text) ?? /^()([½¼¾⅓⅔⅛])/.exec(text);
  if (mixed) {
    return { value: Number(mixed[1] || 0) + GLYPHS[mixed[2]], rest: text.slice(mixed[0].length) };
  }
  const whole = /^(\d+)\s+(\d+)\/(\d+)(?=\s|$)/.exec(text);
  if (whole && Number(whole[3]) > 0) {
    return {
      value: Number(whole[1]) + Number(whole[2]) / Number(whole[3]),
      rest: text.slice(whole[0].length),
    };
  }
  const fraction = /^(\d+)\/(\d+)/.exec(text);
  if (fraction && Number(fraction[2]) > 0) {
    return {
      value: Number(fraction[1]) / Number(fraction[2]),
      rest: text.slice(fraction[0].length),
    };
  }
  const plain = /^\d+(?:[.,]\d+)?/.exec(text);
  if (plain)
    return { value: Number(plain[0].replace(",", ".")), rest: text.slice(plain[0].length) };
  return null;
}

const STAPLES = [
  "sal",
  "pimenta",
  "azeite",
  "oleo",
  "agua",
  "acucar",
  "vinagre",
  "salt",
  "pepper",
  "olive oil",
  "oil",
  "water",
  "sugar",
  "vinegar",
];

/** Whether the name is a staple ("sal grosso", "Azeite", "olive oil"). */
export function isPantry(name: string): boolean {
  const folded = fold(name).trim();
  return STAPLES.some((s) => folded === s || folded.startsWith(`${s} `));
}

/** Drops a leading "de" / "of" that joins a unit or "q.b." to the name. */
function dropLink(text: string): string {
  return text
    .trim()
    .replace(/^(?:de|of)\s+/i, "")
    .trim();
}

/** Reads one line like "1/2 colher de chá de sal" into an ingredient. */
export function parseIngredient(line: string): Ingredient {
  const text = line.trim().replace(/\s+/g, " ");
  const plain = (): Ingredient => ({
    quantity: null,
    unit: "",
    name: text,
    pantry: isPantry(text),
  });
  const asNeeded = /^q\.?\s?b\.?(?=\s|$)/i.exec(text);
  if (asNeeded) {
    const name = dropLink(text.slice(asNeeded[0].length));
    return name ? { quantity: null, unit: "", name, pantry: isPantry(name) } : plain();
  }
  const number = takeNumber(text);
  if (!number) return plain();
  let rest = number.rest.trim();
  let unit = "";
  for (const candidate of UNIT_PATTERNS) {
    const found = candidate.pattern.exec(rest);
    if (found) {
      unit = found[0].replace(/\s+/g, " ").toLowerCase();
      rest = dropLink(rest.slice(found[0].length));
      break;
    }
  }
  if (!rest) return plain();
  return { quantity: number.value, unit, name: rest, pantry: isPantry(rest) };
}

/** A number for the language, at most two decimals: "1,5" in Portuguese, "1.5" otherwise. */
export function formatNumber(value: number, language = "pt-PT"): string {
  const text = String(Math.round(value * 100) / 100);
  return language.toLowerCase().startsWith("pt") ? text.replace(".", ",") : text;
}

/** "400 g bacalhau", "1,5 kg batatas", "q.b. sal"; the quantity times `factor` (to scale servings). */
export function formatIngredient(ing: Ingredient, factor = 1, language = "pt-PT"): string {
  const parts: string[] = [];
  if (ing.quantity === null) {
    if (ing.unit === "") parts.push("q.b.");
  } else {
    parts.push(formatNumber(ing.quantity * factor, language));
  }
  if (ing.unit) {
    parts.push(ing.unit);
    // The joining word follows the unit's own language, not the device's: "3 dentes de alho".
    if (!SHORT_UNITS.has(ing.unit)) parts.push(ENGLISH_UNITS.has(ing.unit) ? "of" : "de");
  }
  parts.push(ing.name);
  return parts.join(" ");
}

/** The steps, one per non-empty line. */
export function stepLines(steps: string): string[] {
  return steps
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The recipes matching the words of the query (each in the name, a tag or an ingredient), without
 * regard to case or accents, narrowed to one tag; favourites first, then by name. `label` gives
 * a tag's shown name, so "sopa" finds the tag "soup".
 */
export function searchRecipes(
  recipes: Recipe[],
  query: string,
  tag?: string,
  label: (tag: string) => string = (t) => t,
): Recipe[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return recipes
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => {
      const hay = fold(
        [r.name, ...r.tags, ...r.tags.map(label), ...r.ingredients.map((i) => i.name)].join("\n"),
      );
      return words.every((w) => hay.includes(w));
    })
    .sort(
      (a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name, "pt"),
    );
}
