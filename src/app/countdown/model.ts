import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Countdown } from "../../core/countdown";
import { api } from "../api";

type Answer = { items: Countdown[]; marked: string[] };

/** The Wall's next countdowns and which Entries are marked to count the days to. */
export function useCountdowns() {
  return useQuery({
    queryKey: ["countdowns"],
    queryFn: () => api<Answer>("/countdowns"),
    staleTime: 60_000,
  });
}

/** Marks an Entry to count the days to, or stops counting. */
export function useMarkCountdown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, on }: { entryId: string; on: boolean }) =>
      api(`/countdowns/${entryId}`, { method: on ? "PUT" : "DELETE" }),
    onMutate: ({ entryId, on }) =>
      queryClient.setQueryData<Answer>(["countdowns"], (old) =>
        old
          ? {
              ...old,
              marked: on ? [...old.marked, entryId] : old.marked.filter((id) => id !== entryId),
            }
          : old,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["countdowns"] }),
  });
}
