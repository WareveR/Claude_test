import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { NewKind } from "../../core/new-kind";
import { api } from "../api";
import { ErrorText } from "../screens/form";
import { BUTTON } from "../ui/button";

/**
 * Turns an Entry into a Task or a Task into an Entry, after saying what it keeps and what goes,
 * then opens the new one in place of the old.
 */
export function ConvertButton({
  path,
  to,
  confirm,
}: {
  /** The conversion's address in the API, such as `/entries/:id/to-task`. */
  path: string;
  to: NewKind;
  confirm: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const convert = useMutation({
    mutationFn: () => api<{ id: string }>(path, { method: "POST" }),
    onSuccess: async ({ id }) => {
      await Promise.all(
        ["entries", "entry", "tasks", "task", "checklists", "checklist"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      navigate(`/${to === "task" ? "tasks" : "entries"}/${id}`, { replace: true });
    },
  });
  return (
    <>
      <button
        type="button"
        className={BUTTON}
        disabled={convert.isPending}
        onClick={() => window.confirm(confirm) && convert.mutate()}
      >
        {t(to === "task" ? "convert.toTask" : "convert.toEntry")}
      </button>
      {convert.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </>
  );
}
