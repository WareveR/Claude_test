import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Lift } from "../../core/lifts";
import { api } from "../api";

export type { Lift };

/** Every Lift this Account sees, by Entry. */
export function useLifts() {
  const query = useQuery({
    queryKey: ["lifts"],
    queryFn: () => api<Lift[]>("/lifts"),
    staleTime: 60_000,
  });
  return useMemo(
    () => new Map((query.data ?? []).map((lift) => [lift.entryId, lift])),
    [query.data],
  );
}

export function useSetLift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }: Lift) =>
      api<Lift>(`/lifts/${entryId}`, { method: "PUT", body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["lifts"] }),
  });
}

export function useRemoveLift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api(`/lifts/${entryId}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["lifts"] }),
  });
}
