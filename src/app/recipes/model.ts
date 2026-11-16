import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_TAGS, type Recipe } from "../../core/recipe";
import { api } from "../api";

export type { Recipe };

export const RECIPES = ["recipes"];

/** Every Recipe, by name; the browser searches and filters them. */
export function useRecipes() {
  return useQuery({ queryKey: RECIPES, queryFn: () => api<Recipe[]>("/recipes") });
}

export type RecipeFields = Pick<
  Recipe,
  | "name"
  | "servings"
  | "minutes"
  | "tags"
  | "ingredients"
  | "steps"
  | "source"
  | "notes"
  | "photoKey"
  | "favourite"
>;

/** Changes some fields of a Recipe; the change shows at once. */
export function useChangeRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: Partial<RecipeFields> }) =>
      api<Recipe>(`/recipes/${id}`, { method: "PATCH", body: change }),
    onMutate: async ({ id, change }) => {
      await queryClient.cancelQueries({ queryKey: RECIPES });
      queryClient.setQueryData<Recipe[]>(RECIPES, (all) =>
        all?.map((r) => (r.id === id ? { ...r, ...change } : r)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: RECIPES }),
  });
}

/** Adds a Recipe (under an id the device picks) or replaces the fields of an existing one. */
export function useSaveRecipe(existingId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: RecipeFields) =>
      existingId
        ? api<Recipe>(`/recipes/${existingId}`, { method: "PATCH", body: fields })
        : api<Recipe>("/recipes", { method: "POST", body: { id: crypto.randomUUID(), ...fields } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPES }),
  });
}

/** Deletes a Recipe for good. */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/recipes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPES }),
  });
}

/** A tag as shown: a default one in the device's language, any other as typed. */
export function useTagLabel() {
  const { t } = useTranslation();
  return (tag: string) =>
    (DEFAULT_TAGS as readonly string[]).includes(tag) ? t(`recipes.tagNames.${tag}`) : tag;
}
