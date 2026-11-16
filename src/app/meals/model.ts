import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Meal, MealSlot } from "../../core/meal-plan";
import type { PlainDate } from "../../core/plain-date";
import { api, RANGE_STALE_TIME } from "../api";

export type { Meal, MealSlot };

/** The Meals planned from one date to another, by date, lunch before dinner. */
export function useMeals(from: PlainDate, to: PlainDate) {
  return useQuery({
    queryKey: ["meals", from, to],
    queryFn: () => api<Meal[]>(`/meals?from=${from}&to=${to}`),
    staleTime: RANGE_STALE_TIME,
  });
}

/** What a slot is set to: a Recipe (whose name is kept as the text), or free text. */
export type MealChange = {
  date: PlainDate;
  slot: MealSlot;
  recipeId: string | null;
  text: string;
  servings: number | null;
};

type Cached = [readonly unknown[], Meal[] | undefined];

/** Applies a change to every cached range holding the date, so each view shows it at once. */
function useOptimistic() {
  const queryClient = useQueryClient();
  return async (date: PlainDate, slot: MealSlot, put: (existing?: Meal) => Meal | null) => {
    await queryClient.cancelQueries({ queryKey: ["meals"] });
    for (const [key, meals] of queryClient.getQueriesData<Meal[]>({
      queryKey: ["meals"],
    }) as Cached[]) {
      const [, from, to] = key as [string, PlainDate, PlainDate];
      if (!meals || date < from || date > to) continue;
      const rest = meals.filter((m) => !(m.date === date && m.slot === slot));
      const made = put(meals.find((m) => m.date === date && m.slot === slot));
      const next = made ? [...rest, made] : rest;
      next.sort((a, b) =>
        a.date === b.date
          ? Number(a.slot === "dinner") - Number(b.slot === "dinner")
          : a.date < b.date
            ? -1
            : 1,
      );
      queryClient.setQueryData(key, next);
    }
  };
}

/** Plans a slot (replacing what was there); it shows at once. */
export function useSetMeal() {
  const queryClient = useQueryClient();
  const optimistic = useOptimistic();
  return useMutation({
    mutationFn: ({ date, slot, ...body }: MealChange) =>
      api<Meal>(`/meals/${date}/${slot}`, { method: "PUT", body }),
    onMutate: ({ date, slot, recipeId, text, servings }) =>
      optimistic(date, slot, (existing) => {
        const now = new Date().toISOString();
        return {
          id: existing?.id ?? `${date}-${slot}`,
          date,
          slot,
          recipeId,
          text,
          servings,
          createdAt: existing?.createdAt ?? now,
          changedAt: now,
        };
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
  });
}

/** Empties a slot; it shows at once. */
export function useRemoveMeal() {
  const queryClient = useQueryClient();
  const optimistic = useOptimistic();
  return useMutation({
    mutationFn: ({ date, slot }: { date: PlainDate; slot: MealSlot }) =>
      api(`/meals/${date}/${slot}`, { method: "DELETE" }),
    onMutate: ({ date, slot }) => optimistic(date, slot, () => null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
  });
}
