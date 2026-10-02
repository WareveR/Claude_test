import { useQuery } from "@tanstack/react-query";
import type { Repetition } from "../../core/repetition";
import { api } from "../api";

export type Checklist = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  repetition: Repetition | null;
  remindAtStart: boolean;
  personIds: string[];
  rounds: { label: string; done: number; total: number }[];
  createdAt: string;
  changedAt: string;
};

export type ChecklistDraft = Pick<
  Checklist,
  "name" | "startDate" | "endDate" | "repetition" | "remindAtStart" | "personIds"
>;

export function useChecklists() {
  return useQuery({ queryKey: ["checklists"], queryFn: () => api<Checklist[]>("/checklists") });
}

export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: ["checklist", id],
    queryFn: () => api<Checklist>(`/checklists/${id}`),
    enabled: Boolean(id),
  });
}
