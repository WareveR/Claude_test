import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GiftIdea, GiftInput } from "../../core/gifts";
import { api } from "../api";

export type { GiftIdea };

/** Every Gift Idea this Account sees: never those for its own Person. */
export function useGifts() {
  return useQuery({
    queryKey: ["gifts"],
    queryFn: () => api<GiftIdea[]>("/gifts"),
    staleTime: 60_000,
  });
}

export function useSaveGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: GiftInput & { id?: string }) =>
      id
        ? api<GiftIdea>(`/gifts/${id}`, { method: "PUT", body })
        : api<GiftIdea>("/gifts", { method: "POST", body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["gifts"] }),
  });
}

export function useDeleteGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/gifts/${id}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["gifts"] }),
  });
}
