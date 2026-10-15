import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { isDescendant, SEXES, type Relative, type Sex } from "../../core/family-tree";
import { api } from "../api";
import { readyToEdit } from "../offline/fresh";
import { uploadPhoto } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { paths } from "../paths";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { RELATIVES, useRelatives } from "./model";

/** Adding or changing someone in the Family Tree. */
export function RelativePage() {
  const { id } = useParams();
  const relatives = useRelatives();
  if (!readyToEdit(relatives)) return null;
  const relative = relatives.data!.find((r) => r.id === id);
  return <RelativeForm key={id} relative={relative} relatives={relatives.data!} />;
}

function RelativeForm({ relative, relatives }: { relative?: Relative; relatives: Relative[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const byId = new Map(relatives.map((r) => [r.id, r]));
  // Started from someone's card: as their parent, partner, child or sibling.
  const parentOf = byId.get(search.get("parentOf") ?? "");
  const partnerOf = byId.get(search.get("partnerOf") ?? "");
  const childOf = byId.get(search.get("childOf") ?? "");
  const siblingOf = byId.get(search.get("siblingOf") ?? "");
  const startParents = relative
    ? relative.parentIds
    : childOf
      ? [childOf.id, ...(childOf.partnerIds.length === 1 ? childOf.partnerIds : [])]
      : (siblingOf?.parentIds ?? []);
  const [form, setForm] = useState({
    name: relative?.name ?? "",
    nickname: relative?.nickname ?? "",
    sex: relative?.sex ?? ("" as Sex),
    birthDate: relative?.birthDate ?? "",
    deathDate: relative?.deathDate ?? "",
    birthPlace: relative?.birthPlace ?? "",
    photoKey: relative?.photoKey ?? null,
    notes: relative?.notes ?? "",
    parent1: startParents[0] ?? "",
    parent2: startParents[1] ?? "",
    partnerIds: relative?.partnerIds ?? (partnerOf ? [partnerOf.id] : []),
  });
  const [uploading, setUploading] = useState(false);
  const back = (id?: string) => navigate(id ? `${paths.tree()}?sel=${id}` : paths.tree());
  const others = relatives.filter((r) => r.id !== relative?.id);
  // Nobody can be their own ancestor.
  const parentChoices = others.filter(
    (r) => !relative || !isDescendant(relatives, relative.id, r.id),
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        nickname: form.nickname,
        sex: form.sex,
        birthDate: form.birthDate || null,
        deathDate: form.deathDate || null,
        birthPlace: form.birthPlace,
        photoKey: form.photoKey,
        notes: form.notes,
        parentIds: [form.parent1, form.parent2].filter(Boolean),
        partnerIds: form.partnerIds,
        ...(relative ? {} : { childIds: parentOf ? [parentOf.id] : [] }),
      };
      return relative
        ? api<Relative>(`/relatives/${relative.id}`, { method: "PATCH", body })
        : api<Relative>("/relatives", { method: "POST", body });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: RELATIVES });
      back(saved.id);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/relatives/${relative!.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RELATIVES });
      back();
    },
  });

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const photoKey = await uploadPhoto(file, 320);
      setForm((f) => ({ ...f, photoKey }));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const from = parentOf ?? partnerOf ?? childOf ?? siblingOf;
  const role = parentOf ? "asParent" : partnerOf ? "asPartner" : childOf ? "asChild" : "asSibling";
  const select = "rounded-md border border-line bg-surface px-3 py-2";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">{relative ? relative.name : t("tree.add")}</h1>
      {!relative && from && (
        <p className="-mt-2 text-sm text-muted">{t(`tree.${role}`, { name: from.name })}</p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar
            person={{ name: form.name || "?", photoKey: form.photoKey, color: "#d6e4dc" }}
            size={72}
          />
          <label className={`relative ${BUTTON}`}>
            {t("tree.photo")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </label>
          {form.photoKey && (
            <button
              type="button"
              className={BUTTON}
              onClick={() => setForm({ ...form, photoKey: null })}
            >
              {t("tree.removePhoto")}
            </button>
          )}
        </div>
        <Field label={t("tree.name")}>
          <TextInput
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("tree.nickname")}>
          <TextInput
            maxLength={80}
            value={form.nickname}
            placeholder={t("tree.nicknameExample")}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("tree.sex")}</legend>
          <div className="flex flex-wrap gap-2">
            {SEXES.map((sex) => (
              <label
                key={sex || "x"}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 has-checked:border-accent has-checked:bg-accent/10"
              >
                <input
                  type="radio"
                  name="sex"
                  checked={form.sex === sex}
                  onChange={() => setForm({ ...form, sex })}
                  className="sr-only"
                />
                {t(`tree.sexes.${sex || "x"}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("tree.birthDate")}>
            <TextInput
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </Field>
          <Field label={t("tree.deathDate")}>
            <TextInput
              type="date"
              value={form.deathDate}
              onChange={(e) => setForm({ ...form, deathDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("tree.birthPlace")}>
          <TextInput
            maxLength={120}
            value={form.birthPlace}
            onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("tree.parents")}</legend>
          {(["parent1", "parent2"] as const).map((key, i) => (
            <select
              key={key}
              aria-label={t("tree.parentN", { n: i + 1 })}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className={select}
            >
              <option value="">{t("tree.noParent")}</option>
              {parentChoices
                .filter((r) => r.id !== form[i === 0 ? "parent2" : "parent1"])
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          ))}
        </fieldset>
        {others.length > 0 && (
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1 font-medium">{t("tree.partners")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {others.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 has-checked:border-accent has-checked:bg-accent/10"
                >
                  <input
                    type="checkbox"
                    checked={form.partnerIds.includes(r.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        partnerIds: e.target.checked
                          ? [...form.partnerIds, r.id]
                          : form.partnerIds.filter((p) => p !== r.id),
                      })
                    }
                    className="sr-only"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Field label={t("tree.notes")}>
          <textarea
            rows={5}
            maxLength={4000}
            value={form.notes}
            placeholder={t("tree.notesExample")}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2"
          />
        </Field>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending || uploading}
          saveLabel={t("tree.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => back(relative?.id ?? from?.id)}
        />
      </form>
      {relative && (
        <button
          type="button"
          className={`${BUTTON_DANGER} self-start`}
          onClick={() => {
            if (window.confirm(t("tree.confirmDelete", { name: relative.name }))) remove.mutate();
          }}
        >
          {t("tree.delete")}
        </button>
      )}
    </main>
  );
}
