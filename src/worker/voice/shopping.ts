// Voice commands about the Shopping List: things to add, bought, take off, and what is needed.
import { forStore, rankSuggestions, suggestionFor } from "../../core/shopping";
import { shoppingMatches, shoppingToAdd, splitShoppingNames } from "../../core/shopping-phrase";
import type { Language } from "../../core/languages";
import { schema, type Db } from "../db";
import type { Plan, VoiceState } from "./helpers";

/**
 * Things to put on the Shopping List: those already open on it are left out, and each takes the
 * shop it had last, as when typed on the list.
 */
export async function shoppingAnswer(db: Db, names: string[], store = "") {
  const rows = await db
    .select({
      name: schema.shoppingItem.name,
      store: schema.shoppingItem.store,
      boughtAt: schema.shoppingItem.boughtAt,
      createdAt: schema.shoppingItem.createdAt,
    })
    .from(schema.shoppingItem);
  const { add, already } = shoppingToAdd(names, rows);
  const ranked = rankSuggestions(rows);
  return {
    outcome: "shopping" as const,
    items: add.map((name) => ({
      name,
      store: store || (suggestionFor(ranked, name)?.store ?? ""),
    })),
    already,
  };
}

const SHOPPING_TEXTS: Record<
  Language,
  { bought: string; remove: string; list: string; empty: string; at: (s: string) => string }
> = {
  "pt-PT": {
    bought: "Comprado",
    remove: "Tirar da lista de compras",
    list: "Na lista de compras",
    empty: "A lista de compras está vazia.",
    at: (s) => `no ${s}`,
  },
  en: {
    bought: "Bought",
    remove: "Take off the shopping list",
    list: "On the shopping list",
    empty: "The shopping list is empty.",
    at: (s) => `at ${s}`,
  },
};

/**
 * "I bought the milk", "take the eggs off the list" and "what do we need?" about the Shopping
 * List: a plan for the items said that are open on it, with Undo, or the list read out.
 */
async function shoppingChange(
  db: Db,
  mode: "bought" | "remove" | "ask",
  names: string[],
  store: string,
  language: Language,
) {
  const items = await db.select().from(schema.shoppingItem);
  const texts = SHOPPING_TEXTS[language];
  if (mode === "ask") {
    const open = forStore(
      items.filter((i) => !i.boughtAt),
      store,
    );
    if (open.length === 0) return { outcome: "answer" as const, text: texts.empty };
    const where = store ? ` ${texts.at(store)}` : "";
    const said = open.map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name));
    return { outcome: "answer" as const, text: `${texts.list}${where}: ${said.join(", ")}.` };
  }
  const { found } = shoppingMatches(names, items);
  if (found.length === 0) return { outcome: "notFound" as const };
  const label = found.map((i) => i.name).join(", ");
  const path = (id: string) => `/shopping/items/${id}`;
  const plan: Omit<Plan, "kind"> & { kind: "shopping" } = {
    kind: "shopping",
    id: found.map((i) => i.id).join(","),
    date: null,
    label,
    summary: `${mode === "bought" ? texts.bought : texts.remove}: ${label}`,
    scope: "all",
    apply: {
      all: found.map((i) =>
        mode === "bought"
          ? { method: "PATCH" as const, path: path(i.id), body: { bought: true } }
          : { method: "DELETE" as const, path: path(i.id) },
      ),
    },
    undo: found.map((i) =>
      mode === "bought"
        ? { method: "PATCH" as const, path: path(i.id), body: { bought: false } }
        : {
            method: "POST" as const,
            path: "/shopping/items",
            body: { id: i.id, name: i.name, quantity: i.quantity, note: i.note, store: i.store },
          },
    ),
  };
  return { outcome: "change" as const, plan };
}

/** "… no Lidl", "… at Tesco": a capitalised name after a word for where. */
export const NAMES_SHOP = /\b(?:no|na|do|da|at|from)\s+\p{Lu}/u;

export async function shoppingCommand({ db, answer, language, failed }: VoiceState) {
  const items = Array.isArray(answer.items)
    ? answer.items.filter((i): i is string => typeof i === "string")
    : [];
  const names = splitShoppingNames(items.join("\n"));
  const store = typeof answer.store === "string" ? answer.store.trim().slice(0, 100) : "";
  const mode = answer.shop;
  if (mode === "ask") return await shoppingChange(db, mode, [], store, language);
  if (names.length === 0) return failed;
  if (mode === "bought" || mode === "remove") {
    return await shoppingChange(db, mode, names, store, language);
  }
  return await shoppingAnswer(db, names, store);
}
