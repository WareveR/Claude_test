import { useQuery } from "@tanstack/react-query";
import type { BuiltInTemplate } from "../../core/checklist-template";
import { api } from "../api";

/** A Checklist template as the server keeps it; read it with core's `templateText`. */
export type ChecklistTemplate = {
  id: string;
  builtinKey: BuiltInTemplate | null;
  name: string | null;
  items: string[] | null;
  createdAt: string;
  changedAt: string;
};

export function useTemplates() {
  return useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => api<ChecklistTemplate[]>("/checklist-templates"),
  });
}
