import { fold } from "./recipe";

/**
 * A Person's profile sheet: what the Family keeps looking up about each other. All free text,
 * empty when not known.
 */
export type PersonProfile = {
  /** Clothes size, like "10 anos" or "M". */
  clothes: string;
  /** Shoe size, like "34". */
  shoes: string;
  /** One food or substance per line; Recipes warn when an ingredient matches. */
  allergies: string[];
  /** Their doctor or paediatrician, with a phone if wanted. */
  doctor: string;
  /** School, year and class. */
  school: string;
  notes: string;
  /** An animal's: "Cão", "Gato". */
  species: string;
  breed: string;
  /** The microchip number. */
  chip: string;
  /** What it eats, put on the Shopping List from its page. */
  food: string;
};

/** A Person is someone, or one of the Family's animals (the dog, the cat). */
export type PersonKind = "person" | "animal";

export function isPersonKind(value: unknown): value is PersonKind {
  return value === "person" || value === "animal";
}

export const EMPTY_PROFILE: PersonProfile = {
  clothes: "",
  shoes: "",
  allergies: [],
  doctor: "",
  school: "",
  notes: "",
  species: "",
  breed: "",
  chip: "",
  food: "",
};

export const MAX_PROFILE_FIELD = 200;
export const MAX_PROFILE_NOTES = 2000;
export const MAX_ALLERGIES = 20;
export const MAX_ALLERGY = 60;

const SHORT_FIELDS = [
  "clothes",
  "shoes",
  "doctor",
  "school",
  "species",
  "breed",
  "chip",
  "food",
] as const;

/** The profile sent by the browser, cleaned; or the name of the first bad field. */
export function parseProfile(value: unknown): { profile: PersonProfile } | { field: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { field: "profile" };
  }
  const v = value as Record<string, unknown>;
  const profile: PersonProfile = { ...EMPTY_PROFILE };
  for (const key of SHORT_FIELDS) {
    const text = v[key] ?? "";
    if (typeof text !== "string" || text.trim().length > MAX_PROFILE_FIELD) {
      return { field: `profile.${key}` };
    }
    profile[key] = text.trim();
  }
  const notes = v.notes ?? "";
  if (typeof notes !== "string" || notes.length > MAX_PROFILE_NOTES) {
    return { field: "profile.notes" };
  }
  profile.notes = notes.trim();
  const allergies = v.allergies ?? [];
  if (!Array.isArray(allergies) || allergies.some((a) => typeof a !== "string")) {
    return { field: "profile.allergies" };
  }
  const cleaned = [...new Set((allergies as string[]).map((a) => a.trim()).filter(Boolean))];
  if (cleaned.length > MAX_ALLERGIES || cleaned.some((a) => a.length > MAX_ALLERGY)) {
    return { field: "profile.allergies" };
  }
  profile.allergies = cleaned;
  return { profile };
}

/** A stored profile, with anything missing filled in empty. */
export function readProfile(value: unknown): PersonProfile {
  const parsed = parseProfile(value ?? {});
  return "profile" in parsed ? parsed.profile : { ...EMPTY_PROFILE };
}

/** Words are compared whole, without case or accents, singular or plural ("ovo" finds "ovos"). */
function words(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w.replace(/(es|s)$/u, ""));
}

function mentions(name: string, allergy: string): boolean {
  const have = words(name);
  const want = words(allergy);
  if (want.length === 0) return false;
  // Every word of the allergy, in a row, somewhere in the ingredient.
  return have.some((_, i) => want.every((w, j) => have[i + j] === w));
}

export type AllergyWarning = { person: string; allergy: string; ingredient: string };

/**
 * Which of the active Persons' allergies an ingredient list mentions: "Bia: amendoim (manteiga
 * de amendoim)". One line per Person and allergy, in the Persons' order.
 */
export function allergyWarnings(
  ingredients: string[],
  persons: { name: string; archived?: boolean; profile: Pick<PersonProfile, "allergies"> }[],
): AllergyWarning[] {
  const out: AllergyWarning[] = [];
  for (const person of persons) {
    if (person.archived) continue;
    for (const allergy of person.profile.allergies) {
      const ingredient = ingredients.find((name) => mentions(name, allergy));
      if (ingredient) out.push({ person: person.name, allergy, ingredient });
    }
  }
  return out;
}
