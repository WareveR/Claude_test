import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type PointsStanding = {
  personId: string;
  points: number;
  goal: number | null;
  reward: string;
};

/** Each Person's points and what they save for; only those with points or a goal. */
export function usePoints() {
  return useQuery({
    queryKey: ["points"],
    queryFn: () => api<PointsStanding[]>("/points"),
    staleTime: 60_000,
  });
}

export function useSetGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      personId,
      goal,
      reward,
    }: {
      personId: string;
      goal: number | null;
      reward: string;
    }) => api(`/points/${personId}/goal`, { method: "PUT", body: { goal, reward } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["points"] }),
  });
}

export function useRedeem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => api(`/points/${personId}/redeem`, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["points"] }),
  });
}
