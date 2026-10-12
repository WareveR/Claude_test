import type { BuiltInTemplate } from "./checklist-template";
import type { BuiltInType } from "./entry-type";

/** Words in an Entry's title that call for a predefined list, in either language. */
const BY_WORD: [BuiltInTemplate, string[]][] = [
  ["swimming", ["natacao", "piscina", "swimming", "swim", "pool"]],
  ["gymBag", ["ginasio", "gym", "treino", "workout"]],
  ["shopping", ["compras", "supermercado", "mercado", "groceries", "shopping"]],
  ["beachDay", ["praia", "beach"]],
  ["flight", ["voo", "aeroporto", "flight", "airport"]],
  ["camping", ["campismo", "acampar", "camping"]],
  ["holidayPacking", ["ferias", "viagem", "holiday", "holidays", "trip", "vacation"]],
  ["hospitalBag", ["parto", "maternidade"]],
  ["carService", ["oficina", "mecanico", "garage"]],
  ["christmas", ["natal", "consoada", "christmas"]],
  ["birthdayParty", ["festa", "party"]],
];

/** An Entry Type whose Entries all call for the same list, when the title names none. */
const BY_TYPE: Partial<Record<BuiltInType, BuiltInTemplate>> = {
  appointment: "appointment",
};

const words = (title: string) =>
  title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);

/**
 * The predefined list a new Entry gets to prepare for it: the first one its title names
 * ("Natação" → the swimming bag, "Compras" → shopping), else its type's (an appointment), else
 * none. A Birthday is a Person's date, not a party to prepare.
 */
export function preparationFor(title: string, type: string | null): BuiltInTemplate | null {
  if (type === "birthday") return null;
  const said = new Set(words(title));
  for (const [template, keys] of BY_WORD) if (keys.some((k) => said.has(k))) return template;
  return BY_TYPE[type as BuiltInType] ?? null;
}
