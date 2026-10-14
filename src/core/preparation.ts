import type { BuiltInTemplate } from "./checklist-template";
import { titleWords, type BuiltInType } from "./entry-type";

/**
 * Words in an Entry's title that call for a predefined list, in either language. A shopping
 * trip gets no list of its own: it shows the Family's Shopping List instead.
 */
const BY_WORD: [BuiltInTemplate | "shoppingList", string[]][] = [
  ["swimming", ["natacao", "piscina", "swimming", "swim", "pool"]],
  ["gymBag", ["ginasio", "gym", "treino", "workout"]],
  ["shoppingList", ["compras", "supermercado", "mercado", "groceries", "shopping"]],
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

function namedByTitle(title: string): BuiltInTemplate | "shoppingList" | null {
  const said = new Set(titleWords(title));
  for (const [named, keys] of BY_WORD) if (keys.some((k) => said.has(k))) return named;
  return null;
}

/**
 * The predefined list a new Entry gets to prepare for it: the first one its title names
 * ("Natação" → the swimming bag), else its type's (an appointment), else none. A shopping trip
 * ("Supermercado") gets none: it shows the Shopping List. A Birthday is a Person's date, not a
 * party to prepare.
 */
export function preparationFor(title: string, type: string | null): BuiltInTemplate | null {
  if (type === "birthday") return null;
  const named = namedByTitle(title);
  if (named === "shoppingList") return null;
  return named ?? BY_TYPE[type as BuiltInType] ?? null;
}

/** Whether an Entry is a shopping trip ("Compras", "Supermercado"), to show the Shopping List. */
export function isShoppingEntry(title: string, type: string | null): boolean {
  return type !== "birthday" && namedByTitle(title) === "shoppingList";
}
