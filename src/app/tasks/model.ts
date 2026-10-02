import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Repetition } from "../../core/repetition";
import { api } from "../api";

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  personIds: string[];
  private: boolean;
  doneAt: string | null;
  repetition: Repetition | null;
  seriesId: string | null;
  /** The Checklist this Task belongs to, if any. */
  checklistId: string | null;
  createdAt: string;
  changedAt: string;
};

export type TaskDraft = Pick<
  Task,
  "title" | "notes" | "dueDate" | "dueTime" | "personIds" | "private" | "repetition" | "checklistId"
>;

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: () => api<Task[]>("/tasks") });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api<Task>(`/tasks/${id}`),
    enabled: Boolean(id),
  });
}

/** Ticks a Task done or undoes it, from anywhere a Task shows. */
export function useTick() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, done }: { task: Task; done: boolean }) =>
      api<Task>(`/tasks/${task.id}/done`, { method: done ? "POST" : "DELETE" }),
    // The tick shows at once; the server's answer then settles the done time.
    onMutate: async ({ task, done }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData<Task[]>(["tasks"], (tasks) =>
        tasks?.map((t) =>
          t.id === task.id ? { ...t, doneAt: done ? new Date().toISOString() : null } : t,
        ),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
