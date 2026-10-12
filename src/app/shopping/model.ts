import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { ShoppingItem, ShoppingSuggestion } from "../../core/shopping";
import { api } from "../api";

export type { ShoppingItem };

export type ShoppingHistory = {
  suggestions: ShoppingSuggestion[];
  /** Every shop used, most often first. */
  stores: string[];
  /** The latest bought items, most recent first. */
  bought: ShoppingItem[];
};

const ITEMS = ["shopping"];
const HISTORY = ["shopping-history"];

export function useShoppingItems() {
  return useQuery({ queryKey: ITEMS, queryFn: () => api<ShoppingItem[]>("/shopping/items") });
}

export function useShoppingHistory() {
  return useQuery({
    queryKey: HISTORY,
    queryFn: () => api<ShoppingHistory>("/shopping/history"),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ITEMS });
    void queryClient.invalidateQueries({ queryKey: HISTORY });
  };
}

export type NewItem = Pick<ShoppingItem, "name" | "quantity" | "note" | "store">;

/**
 * Adds an item; it shows at once under an id the device picks, so it can be ticked or changed
 * before the server answers.
 */
export function useAddItem() {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (item: NewItem & { id: string }) =>
      api<ShoppingItem>("/shopping/items", { method: "POST", body: item }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ITEMS });
      const now = new Date().toISOString();
      queryClient.setQueryData<ShoppingItem[]>(ITEMS, (items) => [
        ...(items ?? []),
        { ...item, boughtAt: null, createdAt: now, changedAt: now },
      ]);
    },
    onSettled: refresh,
  });
}

export type ItemChange = Partial<NewItem> & { bought?: boolean };

/** Changes an item's details, or ticks it bought or back to buy; the change shows at once. */
export function useChangeItem() {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: ItemChange }) =>
      api<ShoppingItem>(`/shopping/items/${id}`, { method: "PATCH", body: change }),
    onMutate: async ({ id, change }) => {
      await queryClient.cancelQueries({ queryKey: ITEMS });
      const { bought, ...fields } = change;
      queryClient.setQueryData<ShoppingItem[]>(ITEMS, (items) =>
        items?.map((item) =>
          item.id !== id
            ? item
            : {
                ...item,
                ...fields,
                boughtAt:
                  bought === undefined
                    ? item.boughtAt
                    : bought
                      ? (item.boughtAt ?? new Date().toISOString())
                      : null,
              },
        ),
      );
    },
    onSettled: refresh,
  });
}

/** Deletes an item for good. */
export function useDeleteItem() {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api(`/shopping/items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ITEMS });
      queryClient.setQueryData<ShoppingItem[]>(ITEMS, (items) =>
        items?.filter((item) => item.id !== id),
      );
    },
    onSettled: refresh,
  });
}

export function newItemId() {
  return crypto.randomUUID();
}

const STORE_KEY = "shopping-store";
const storeListeners = new Set<() => void>();
/** Where the choice is kept when this browser keeps nothing. */
let unsaved = "";

function readStore(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return unsaved;
  }
}

/** The shop this device last narrowed the list to; "" for every shop. */
export function useStoreFilter() {
  return useSyncExternalStore(
    (listener) => {
      storeListeners.add(listener);
      return () => storeListeners.delete(listener);
    },
    readStore,
    () => "",
  );
}

export function setStoreFilter(store: string) {
  try {
    localStorage.setItem(STORE_KEY, store);
  } catch {
    // Not remembered; it still applies until the page reloads.
    unsaved = store;
  }
  for (const listener of storeListeners) listener();
}
