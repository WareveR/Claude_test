import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Importance } from "../../core/entry-type";
import type { Repetition } from "../../core/repetition";
import { api } from "../api";
import { fromList } from "../offline/from-list";
import i18n from "../i18n";

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  personIds: string[];
  private: boolean;
  /** Private and not this Account's to see: only its due time and Persons came. */
  hidden?: boolean;
  /** High ones come first among Tasks due at the same time. */
  importance: Importance;
  doneAt: string | null;
  repetition: Repetition | null;
  seriesId: string | null;
  /** The Checklist this Task belongs to, if any. */
  checklistId: string | null;
  /** The item this one sits inside, in the same Checklist; null at the top. */
  parentId: string | null;
  /** The Entry a loose Task prepares for, if any. */
  entryId: string | null;
  createdAt: string;
  changedAt: string;
};

export type TaskDraft = Pick<
  Task,
  | "title"
  | "notes"
  | "dueDate"
  | "dueTime"
  | "personIds"
  | "private"
  | "importance"
  | "repetition"
  | "checklistId"
  | "entryId"
>;

/** A hidden Private Task reads "Private". */
function nameHidden(task: Task): Task {
  return task.hidden ? { ...task, title: i18n.t("entries.private") } : task;
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await api<Task[]>("/tasks")).map(nameHidden),
  });
}

export function useTask(id: string | undefined) {
  const queryClient = useQueryClient();
  // The Tasks list already holds the Task: it shows at once while its own request runs.
  const listed = () => fromList<Task>(queryClient, ["tasks"], id);
  return useQuery({
    queryKey: ["task", id],
    queryFn: async () => nameHidden(await api<Task>(`/tasks/${id}`)),
    enabled: Boolean(id),
    initialData: () => listed()?.data,
    initialDataUpdatedAt: () => listed()?.updatedAt,
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
