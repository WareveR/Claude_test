import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { BuiltInType, EntryTypeDefaults } from "../../core/entry-type";
import { api } from "../api";

export type EntryType = {
  id: string;
  builtinKey: BuiltInType | null;
  name: string | null;
  color: string;
  icon: string | null;
  thumbnailKey: string | null;
  defaults: EntryTypeDefaults;
  deletable: boolean;
};

export function useEntryTypes() {
  return useQuery({ queryKey: ["entry-types"], queryFn: () => api<EntryType[]>("/entry-types") });
}

/** A built-in type reads in the device's language until the Family renames it. */
export function typeName(type: Pick<EntryType, "name" | "builtinKey">, t: TFunction): string {
  return type.name ?? t(`entryTypes.builtin.${type.builtinKey}`);
}

/** Reminder offsets offered in forms, in minutes before the start. */
export const REMINDER_CHOICES = [0, 15, 30, 60, 120, 1440, 2880, 4320, 10080];

export function reminderLabel(minutes: number, t: TFunction): string {
  if (minutes === 0) return t("reminders.atStart");
  if (minutes % 1440 === 0) return t("reminders.daysBefore", { count: minutes / 1440 });
  if (minutes % 60 === 0) return t("reminders.hoursBefore", { count: minutes / 60 });
  return t("reminders.minutesBefore", { count: minutes });
}
