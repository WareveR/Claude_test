import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { templateText } from "../../core/checklist-template";
import { api } from "../api";
import { useSignedIn } from "../family";
import { useOnline } from "../offline/online";
import { ErrorText } from "../screens/form";
import { BUTTON } from "../ui/button";
import { useTemplates, type ChecklistTemplate } from "./templates";

/** The templates' line icon colour, readable on every theme. */
const LIST_COLOR = "#16a34a";

/** Settings › Family: the Checklist templates, a new one, and Restore defaults. */
export function TemplatesSection() {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const online = useOnline();
  const templates = useTemplates();
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: () =>
      api<ChecklistTemplate[]>("/checklist-templates/restore-defaults", { method: "POST" }),
    onSuccess: (list) => queryClient.setQueryData(["checklist-templates"], list),
  });
  return (
    <section className="flex flex-col gap-2" aria-labelledby="templates-title">
      <h2 id="templates-title" className="font-semibold">
        {t("checklistTemplates.title")}
      </h2>
      <p className="text-xs text-muted">{t("checklistTemplates.hint")}</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {templates.data?.map((template) => {
          const { name, items } = templateText(template, language);
          return (
            <li key={template.id}>
              <Link
                to={`/settings/checklist-templates/${template.id}`}
                className="flex items-center gap-3 px-3 py-2"
              >
                <ListChecks aria-hidden size={20} strokeWidth={1.75} color={LIST_COLOR} />
                <span className="min-w-0 flex-1 break-words">{name}</span>
                <span className="text-sm text-muted">
                  {t("checklistTemplates.itemCount", { count: items.length })}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            to="/settings/checklist-templates/new"
            className="flex items-center gap-3 px-3 py-2"
          >
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("checklistTemplates.add")}
          </Link>
        </li>
      </ul>
      <button
        type="button"
        className={`${BUTTON} self-start`}
        disabled={!online || restore.isPending}
        onClick={() => {
          if (window.confirm(t("checklistTemplates.confirmRestore"))) restore.mutate();
        }}
      >
        <RotateCcw aria-hidden size={16} />
        {t("checklistTemplates.restore")}
      </button>
      {restore.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
    </section>
  );
}
