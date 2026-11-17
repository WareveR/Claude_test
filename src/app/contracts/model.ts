import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Contract, ContractInput } from "../../core/contracts";
import { api } from "../api";

export type { Contract, ContractInput };

/** The Family's Contracts and bills, by name. */
export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: () => api<Contract[]>("/contracts"),
    staleTime: 60_000,
  });
}

/** Adds a Contract, or changes one when `id` is given; its Task to pay changes with it. */
export function useSaveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ContractInput & { id?: string }) =>
      id
        ? api<Contract>(`/contracts/${id}`, { method: "PUT", body })
        : api<Contract>("/contracts", { method: "POST", body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/contracts/${id}`, { method: "DELETE" }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
