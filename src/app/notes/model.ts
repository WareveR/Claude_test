import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Note, NoteColor, NoteKeep } from "../../core/notes";
import { api } from "../api";

export type { Note };

/** The Notes up on the Wall, newest first. */
export function useNotes() {
  return useQuery({ queryKey: ["notes"], queryFn: () => api<Note[]>("/notes") });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { text: string; color: NoteColor; keep: NoteKeep }) =>
      api<Note>("/notes", { method: "POST", body }),
    onSuccess: (note) =>
      queryClient.setQueryData<Note[]>(["notes"], (notes) => [note, ...(notes ?? [])]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

/** Takes a Note down; it goes at once. */
export function useRemoveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notes/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notes"] });
      queryClient.setQueryData<Note[]>(["notes"], (notes) => notes?.filter((n) => n.id !== id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}
