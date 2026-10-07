import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";
import { templateText } from "../../core/checklist-template";
import { api } from "../api";
import { useSignedIn } from "../family";
import { readyToEdit } from "../offline/fresh";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { useTemplates, type ChecklistTemplate } from "./templates";

const BACK = "/settings/family";

/** A Checklist template's page: /settings/checklist-templates/new, or one to edit. */
export function TemplatePage() {
  const { id } = useParams();
  const templates = useTemplates();
  const isNew = id === "new";
  if (!isNew && !readyToEdit(templates)) return null;
  const template = templates.data?.find((tpl) => tpl.id === id);
  if (!isNew && !template) return <Navigate to={BACK} replace />;
  return <TemplateForm key={id} template={template} />;
}

/** A template's name and its items: add, rename, remove and move them up or down. */
function TemplateForm({ template }: { template?: ChecklistTemplate }) {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shown = template ? templateText(template, language) : { name: "", items: [] };
  const [name, setName] = useState(shown.name);
  // Each row keeps a stable key while items move.
  const [items, setItems] = useState(() => shown.items.map((text, i) => ({ key: i, text })));
  const [nextKey, setNextKey] = useState(shown.items.length);
  const [newItem, setNewItem] = useState("");

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    navigate(BACK);
  };
  const save = useMutation({
    mutationFn: () => {
      const list = items.map((item) => item.text.trim()).filter(Boolean);
      if (!template) {
        return api("/checklist-templates", { method: "POST", body: { name, items: list } });
      }
      // What wasn't changed is sent back as stored, so a built-in template keeps translating.
      const body = {
        name: name.trim() === shown.name ? template.name : name,
        items: list.join("\n") === shown.items.join("\n") ? template.items : list,
      };
      return api(`/checklist-templates/${template.id}`, { method: "PUT", body });
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => api(`/checklist-templates/${template!.id}`, { method: "DELETE" }),
    onSuccess: done,
  });

  const move = (from: number, to: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setItems((list) => [...list, { key: nextKey, text }]);
    setNextKey((k) => k + 1);
    setNewItem("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold break-words">
        {template ? shown.name : t("checklistTemplates.add")}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("checklistTemplates.name")}>
          <TextInput
            required
            autoFocus={!template}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("checklistTemplates.items")}</legend>
          {items.length === 0 && <p className="text-muted">{t("checklists.noItems")}</p>}
          <ol className="flex flex-col gap-2" data-testid="template-items">
            {items.map((item, i) => (
              <li key={item.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput
                    aria-label={t("checklistTemplates.itemLabel", { n: i + 1 })}
                    value={item.text}
                    onChange={(e) =>
                      setItems((list) =>
                        list.map((x) => (x.key === item.key ? { ...x, text: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={t("checklistTemplates.moveUp", { title: item.text })}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp aria-hidden size={16} />
                </button>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={t("checklistTemplates.moveDown", { title: item.text })}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown aria-hidden size={16} />
                </button>
                <button
                  type="button"
                  className={BUTTON_DANGER}
                  aria-label={t("checklists.removeItem", { title: item.text })}
                  onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))}
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={t("checklists.newItem")}>
                <TextInput
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                />
              </Field>
            </div>
            <button type="button" className={BUTTON} disabled={!newItem.trim()} onClick={addItem}>
              <Plus aria-hidden size={16} />
              {t("checklists.addItem")}
            </button>
          </div>
        </fieldset>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate(-1)}
        />
      </form>
      {template && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            className={BUTTON_DANGER}
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t("checklistTemplates.confirmDelete", { name: shown.name })))
                remove.mutate();
            }}
          >
            {t("checklistTemplates.delete")}
          </button>
          {remove.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        </div>
      )}
    </main>
  );
}
