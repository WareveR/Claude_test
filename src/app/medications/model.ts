import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Dose, Medication, MedicationInput } from "../../core/medication";
import { api } from "../api";

export type { Dose, Medication };

/** The Medications this Account sees: a Private one only by its creator and its Person. */
export function useMedications() {
  return useQuery({
    queryKey: ["medications"],
    queryFn: () => api<Medication[]>("/medications"),
    staleTime: 60_000,
  });
}

/** The doses taken on a day. */
export function useDoses(date: string) {
  return useQuery({
    queryKey: ["medications", "doses", date],
    queryFn: () => api<Dose[]>(`/medications/doses?date=${date}`),
    staleTime: 30_000,
  });
}

export function useSaveMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MedicationInput & { id?: string }) =>
      id
        ? api<Medication>(`/medications/${id}`, { method: "PUT", body })
        : api<Medication>("/medications", { method: "POST", body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useDeleteMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/medications/${id}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["medications"] }),
  });
}

/** Ticks a dose taken, or takes the tick back. */
export function useTakeDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      medicationId,
      date,
      time,
      taken,
    }: {
      medicationId: string;
      date: string;
      time: string;
      taken: boolean;
    }) =>
      taken
        ? api(`/medications/${medicationId}/doses`, { method: "POST", body: { date, time } })
        : api(`/medications/${medicationId}/doses?date=${date}&time=${time}`, {
            method: "DELETE",
          }),
    onSettled: (_r, _e, { date }) =>
      queryClient.invalidateQueries({ queryKey: ["medications", "doses", date] }),
  });
}
