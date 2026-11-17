import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Contact, ContactInput } from "../../core/contacts";
import { api } from "../api";

export type { Contact, ContactInput };

/** The Family's Contacts, by name. */
export function useContacts() {
  return useQuery({ queryKey: ["contacts"], queryFn: () => api<Contact[]>("/contacts") });
}

/** Adds a Contact, or changes one when `id` is given. */
export function useSaveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ContactInput & { id?: string }) =>
      id
        ? api<Contact>(`/contacts/${id}`, { method: "PUT", body })
        : api<Contact>("/contacts", { method: "POST", body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/contacts/${id}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });
}
