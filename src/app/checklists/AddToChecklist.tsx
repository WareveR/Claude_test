import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, FolderInput } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useOnline } from "../offline/online";
import { ErrorText, Field } from "../screens/form";
import type { Task } from "../tasks/model";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { useChecklists, type Checklist } from "./model";

type Mode = "move" | "duplicate";

/**
 * Puts a loose Task into a Checklist: "move" makes it an item (losing its date, time,
 * Repetition and Private), "duplicate" adds an item with its title and Persons.
 */
function useAddToChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, checklistId, mode }: { task: Task; checklistId: string; mode: Mode }) =>
      api<Task>(`/tasks/${task.id}/checklist`, { method: "POST", body: { checklistId, mode } }),
    onSuccess: async (_, { task }) => {
      queryClient.removeQueries({ queryKey: ["task", task.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/** Asked when a Task is dropped on a Checklist: Move, Duplicate or Cancel. */
export function AddToChecklistDialog({
  task,
  checklist,
  onClose,
}: {
  task: Task;
  checklist: Checklist;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const add = useAddToChecklist();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const choose = (mode: Mode) =>
    add.mutate({ task, checklistId: checklist.id, mode }, { onSuccess: onClose });
  // On the body: the header's stacking would otherwise trap this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-checklist-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-frame p-5 sm:rounded-2xl"
      >
        <h2 id="add-to-checklist-title" className="text-lg font-semibold break-words">
          {t("checklists.addTo.question", { title: task.title, name: checklist.name })}
        </h2>
        <p className="text-sm text-muted">{t("checklists.addTo.hint")}</p>
        {add.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={add.isPending}
            onClick={() => choose("duplicate")}
          >
            <Copy aria-hidden size={16} color="#0ea5e9" />
            {t("checklists.addTo.duplicate")}
          </button>
          <button
            type="button"
            className={BUTTON_PRIMARY}
            autoFocus
            disabled={add.isPending}
            onClick={() => choose("move")}
          >
            <FolderInput aria-hidden size={16} />
            {t("checklists.addTo.move")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** On a loose Task's form: the same Move or Duplicate, chosen without dragging. */
export function AddToChecklistSection({ task }: { task: Task }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const online = useOnline();
  const checklists = useChecklists().data ?? [];
  const [checklistId, setChecklistId] = useState("");
  const add = useAddToChecklist();
  const chosen = checklists.find((c) => c.id === checklistId);
  if (checklists.length === 0) return null;
  const choose = (mode: Mode) =>
    add.mutate(
      { task, checklistId, mode },
      { onSuccess: () => mode === "move" && navigate(`/checklists/${checklistId}`) },
    );
  return (
    <section
      className="flex flex-col gap-2 border-t border-line pt-4"
      aria-labelledby="add-to-checklist"
    >
      <h2 id="add-to-checklist" className="font-medium">
        {t("checklists.addTo.title")}
      </h2>
      <p className="text-xs text-muted">{t("checklists.addTo.hint")}</p>
      <Field label={t("checklists.addTo.which")}>
        <select
          className="rounded-md border border-line bg-surface px-3 py-2 text-base"
          value={checklistId}
          onChange={(e) => {
            setChecklistId(e.target.value);
            add.reset();
          }}
        >
          <option value="">{t("checklists.addTo.choose")}</option>
          {checklists.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={!chosen || !online || add.isPending}
          onClick={() => choose("move")}
        >
          <FolderInput aria-hidden size={16} color="#16a34a" />
          {t("checklists.addTo.move")}
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={!chosen || !online || add.isPending}
          onClick={() => choose("duplicate")}
        >
          <Copy aria-hidden size={16} color="#0ea5e9" />
          {t("checklists.addTo.duplicate")}
        </button>
      </div>
      {add.isSuccess && add.variables?.mode === "duplicate" && chosen && (
        <p role="status" className="text-sm text-muted">
          {t("checklists.addTo.duplicated", { name: chosen.name })}
        </p>
      )}
      {add.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </section>
  );
}
