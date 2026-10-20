import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field } from "../screens/form";
import { RELATIVES } from "../tree/model";
import { BUTTON } from "../ui/button";
import { usePersons, type Person } from "./model";

const RELATIONS = ["partner", "parent", "child", "sibling", "other"] as const;
const SELECT = "rounded-md border border-line bg-surface px-3 py-2";

/** "Carla is the sister of Sara": a relation to another Person, which links both in the tree. */
export function RelationSection({ person }: { person: Person }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const others = (persons.data ?? []).filter((p) => p.id !== person.id && !p.archived);
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]>("partner");
  const [other, setOther] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api(`/persons/${person.id}/relation`, {
        method: "POST",
        body: { relation, personId: other },
      }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: RELATIVES });
    },
  });
  if (others.length === 0) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    save.mutate();
  }

  return (
    <form
      onSubmit={submit}
      aria-label={t("relations.title")}
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <h2 className="font-semibold">{t("relations.title")}</h2>
      <p className="text-xs text-muted">{t("relations.hint")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("relations.is", { name: person.name })}>
          <select
            className={SELECT}
            value={relation}
            onChange={(e) => setRelation(e.target.value as typeof relation)}
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`relations.kinds.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("relations.of")}>
          <select
            required
            className={SELECT}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          >
            <option value="">{t("relations.pick")}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className={BUTTON} disabled={save.isPending || !other}>
          {t("relations.save")}
        </button>
      </div>
      {saved && (
        <p role="status" className="text-sm text-muted">
          {relation === "other" ? t("relations.savedOther") : t("relations.saved")}
        </p>
      )}
      {save.error && (
        <ErrorText>
          {save.error instanceof ApiError && save.error.body.error === "relation_conflict"
            ? t("relations.conflict")
            : t("errors.unexpected")}
        </ErrorText>
      )}
    </form>
  );
}
