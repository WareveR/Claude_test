import { todayIn, type PlainDate } from "./plain-date";
import {
  foldName,
  SHOPPING_SECTIONS,
  shoppingSection,
  type ShoppingSection,
} from "./shopping-sections";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  note: string;
  /** "" for any shop. */
  store: string;
  boughtAt: string | null;
  createdAt: string;
  changedAt: string;
};

/**
 * Whether an item is on the list on the given day: until it is bought, and on the day it was
 * bought (in the Family Time Zone), so it can still be unticked; from the next day it is only
 * history.
 */
export function onListOn(
  item: Pick<ShoppingItem, "boughtAt">,
  today: PlainDate,
  timeZone: string,
): boolean {
  return !item.boughtAt || todayIn(timeZone, new Date(item.boughtAt)) >= today;
}

const sameText = (a: string, b: string) => foldName(a) === foldName(b);

/**
 * The shops the open items are tagged with, once each in the spelling first used, in
 * alphabetical order.
 */
export function openStores(items: Pick<ShoppingItem, "store" | "boughtAt">[]): string[] {
  const stores: string[] = [];
  for (const item of items) {
    const store = item.store.trim();
    if (!item.boughtAt && store && !stores.some((s) => sameText(s, store))) stores.push(store);
  }
  return stores.sort((a, b) => a.localeCompare(b));
}

/** With a shop chosen, its items and those for any shop; with none (""), everything. */
export function forStore<T extends Pick<ShoppingItem, "store">>(items: T[], store: string): T[] {
  if (!store) return items;
  return items.filter((item) => !item.store.trim() || sameText(item.store, store));
}

export type ShoppingGroups<T> = {
  /** The sections with open items, in shop-walk order, oldest item first. */
  sections: { section: ShoppingSection; items: T[] }[];
  /** Ticked today, most recent first. */
  bought: T[];
};

/** Splits the list into its sections and the items already bought. */
export function groupShopping<T extends Pick<ShoppingItem, "name" | "boughtAt" | "createdAt">>(
  items: T[],
): ShoppingGroups<T> {
  const open = new Map<ShoppingSection, T[]>();
  const bought: T[] = [];
  for (const item of items) {
    if (item.boughtAt) {
      bought.push(item);
      continue;
    }
    const section = shoppingSection(item.name);
    open.set(section, [...(open.get(section) ?? []), item]);
  }
  return {
    sections: SHOPPING_SECTIONS.filter((s) => open.has(s)).map((section) => ({
      section,
      items: open.get(section)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })),
    bought: bought.sort((a, b) => (b.boughtAt ?? "").localeCompare(a.boughtAt ?? "")),
  };
}

/** A name from the history, how often it was put on the list, and the shop it had last. */
export type ShoppingSuggestion = { name: string; count: number; store: string; lastAt: string };

/**
 * The names ever put on the list, most often first (the most recent first among equals), each
 * once whatever its case or accents, in its latest spelling and with its latest shop.
 */
export function rankSuggestions(
  items: Pick<ShoppingItem, "name" | "store" | "createdAt">[],
): ShoppingSuggestion[] {
  const byName = new Map<string, ShoppingSuggestion>();
  for (const item of items) {
    const key = foldName(item.name);
    if (!key) continue;
    const seen = byName.get(key);
    if (!seen) {
      byName.set(key, {
        name: item.name.trim(),
        count: 1,
        store: item.store,
        lastAt: item.createdAt,
      });
      continue;
    }
    seen.count += 1;
    if (item.createdAt > seen.lastAt) {
      seen.name = item.name.trim();
      seen.store = item.store;
      seen.lastAt = item.createdAt;
    }
  }
  return [...byName.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

/**
 * The suggestions for what is being typed: names starting with it, or with a word starting
 * with it, keeping their rank; names already open on the list are left out.
 */
export function matchSuggestions(
  ranked: ShoppingSuggestion[],
  typed: string,
  open: Pick<ShoppingItem, "name">[],
  limit = 6,
): ShoppingSuggestion[] {
  const query = foldName(typed);
  if (!query) return [];
  const taken = new Set(open.map((item) => foldName(item.name)));
  return ranked
    .filter((s) => {
      const name = foldName(s.name);
      return !taken.has(name) && (name.startsWith(query) || name.includes(` ${query}`));
    })
    .slice(0, limit);
}

/** The history's suggestion for exactly this name, if any. */
export function suggestionFor(
  ranked: ShoppingSuggestion[],
  name: string,
): ShoppingSuggestion | undefined {
  const key = foldName(name);
  return ranked.find((s) => foldName(s.name) === key);
}

/** The item already on the list under this name, whatever its case or accents. */
export function sameNameOnList<T extends Pick<ShoppingItem, "name">>(
  items: T[],
  name: string,
): T | undefined {
  const key = foldName(name);
  return items.find((item) => foldName(item.name) === key);
}
