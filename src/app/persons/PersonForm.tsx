import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { PERSON_COLORS, uploadPhoto, usePersons, type Person } from "./model";
import { PersonAvatar } from "./PersonAvatar";
import { RelationSection } from "./RelationSection";
import { PersonContacts } from "../contacts/MatchedContacts";
import { readyToEdit } from "../offline/fresh";
import {
  EMPTY_PROFILE,
  MAX_PROFILE_FIELD,
  MAX_PROFILE_NOTES,
  type PersonKind,
} from "../../core/person-profile";
import { addShoppingItems, refreshShopping } from "../shopping/model";
import { BUTTON, BUTTON_DANGER } from "../ui/button";

export function PersonPage() {
  const { id } = useParams();
  const persons = usePersons();
  if (id !== "new" && !readyToEdit(persons)) return null;
  const person = persons.data?.find((p) => p.id === id);
  return <PersonForm key={id} person={person} />;
}

function PersonForm({ person }: { person?: Person }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Voice Entry opens a new Person filled in.
  const given = (
    useLocation().state as {
      values?: { name: string; color: string; dateOfBirth: string | null; nicknames: string[] };
    } | null
  )?.values;
  const [form, setForm] = useState({
    name: person?.name ?? given?.name ?? "",
    color: person?.color ?? given?.color ?? PERSON_COLORS[0],
    photoKey: person?.photoKey ?? null,
    dateOfBirth: person?.dateOfBirth ?? given?.dateOfBirth ?? "",
    nicknames: person?.nicknames.join(", ") ?? given?.nicknames.join(", ") ?? "",
  });
  const [profile, setProfile] = useState({
    ...(person?.profile ?? EMPTY_PROFILE),
    allergies: (person?.profile.allergies ?? []).join(", "),
  });
  const [kind, setKind] = useState<PersonKind>(person?.kind ?? "person");
  const animal = kind === "animal";
  const [foodAdded, setFoodAdded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["persons"] });
    // A date of birth keeps the Person's Birthday Entry in sync.
    await queryClient.invalidateQueries({ queryKey: ["entries"] });
    navigate("/settings/family");
  };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        color: form.color,
        photoKey: form.photoKey,
        dateOfBirth: form.dateOfBirth || null,
        nicknames: form.nicknames.split(","),
        profile: { ...profile, allergies: profile.allergies.split(",") },
        kind,
      };
      return person
        ? api(`/persons/${person.id}`, { method: "PATCH", body })
        : api("/persons", { method: "POST", body });
    },
    onSuccess: done,
  });
  const archive = useMutation({
    mutationFn: (body: { archived: boolean; keepBirthday?: boolean }) =>
      api(`/persons/${person!.id}`, { method: "PATCH", body }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => api(`/persons/${person!.id}`, { method: "DELETE" }),
    onSuccess: done,
  });

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const photoKey = await uploadPhoto(file);
      setForm((f) => ({ ...f, photoKey }));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{person ? person.name : t("persons.add")}</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar person={{ ...form, name: form.name || "?" }} size={64} />
          <label className={`relative ${BUTTON}`}>
            {t("persons.photo")}
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
              {t("persons.removePhoto")}
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label={t("persons.kind")} className="flex gap-2">
          {(["person", "animal"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                kind === k ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {t(`persons.kinds.${k}`)}
            </button>
          ))}
        </div>
        <Field label={t("persons.name")}>
          <TextInput
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("persons.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {PERSON_COLORS.map((color) => (
              <label key={color} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={color}
                  checked={form.color === color}
                  onChange={() => setForm({ ...form, color })}
                  className="peer sr-only"
                  aria-label={color}
                />
                <span
                  style={{ backgroundColor: color }}
                  className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-accent"
                />
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t("persons.dateOfBirth")}>
          <TextInput
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
        </Field>
        <Field label={t("persons.nicknames")}>
          <TextInput
            value={form.nicknames}
            placeholder={t("persons.nicknamesExample")}
            onChange={(e) => setForm({ ...form, nicknames: e.target.value })}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">{t("persons.nicknamesHint")}</p>
        <details
          data-testid="person-profile"
          open={Object.values(person?.profile ?? {}).some((v) => v.length > 0)}
          className="rounded-md border border-line"
        >
          <summary className="cursor-pointer px-3 py-2 font-medium">
            {t("persons.profile.title")}
          </summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
              {(animal ? (["species", "breed"] as const) : (["clothes", "shoes"] as const)).map(
                (key) => (
                  <Field key={key} label={t(`persons.profile.${key}`)}>
                    <TextInput
                      value={profile[key]}
                      maxLength={MAX_PROFILE_FIELD}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    />
                  </Field>
                ),
              )}
            </div>
            {(animal
              ? (["chip", "food", "allergies"] as const)
              : (["allergies", "doctor", "school"] as const)
            ).map((key) => (
              <Field key={key} label={t(`persons.profile.${key}`)}>
                <TextInput
                  value={profile[key]}
                  maxLength={key === "allergies" ? 1000 : MAX_PROFILE_FIELD}
                  placeholder={t(`persons.profile.${key}Hint`)}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                />
              </Field>
            ))}
            <p className="-mt-2 text-xs text-muted">{t("persons.profile.allergiesNote")}</p>
            {animal && person && person.profile.food && (
              <button
                type="button"
                className={`${BUTTON} self-start`}
                disabled={foodAdded}
                onClick={() =>
                  void addShoppingItems([{ name: person.profile.food }]).then(() => {
                    setFoodAdded(true);
                    void refreshShopping(queryClient);
                  })
                }
              >
                {foodAdded
                  ? t("persons.profile.foodAdded")
                  : t("persons.profile.addFood", { food: person.profile.food })}
              </button>
            )}
            {animal && <p className="text-xs text-muted">{t("persons.profile.vetHint")}</p>}
            <Field label={t("persons.profile.notes")}>
              <textarea
                rows={3}
                value={profile.notes}
                maxLength={MAX_PROFILE_NOTES}
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base"
              />
            </Field>
          </div>
        </details>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending || uploading}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate("/settings/family")}
        />
      </form>
      {person && !animal && <RelationSection person={person} />}
      {person && <PersonContacts personId={person.id} />}
      {person && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() =>
              archive.mutate(
                person.archived
                  ? { archived: false }
                  : {
                      archived: true,
                      // A separation or a death: ask whether the Birthday stays on the calendar.
                      keepBirthday:
                        Boolean(person.dateOfBirth) &&
                        window.confirm(t("persons.keepBirthday", { name: person.name })),
                    },
              )
            }
          >
            {person.archived ? t("persons.unarchive") : t("persons.archive")}
          </button>
          <p className="text-xs text-muted">{t("persons.archiveHint")}</p>
          <button
            type="button"
            className={`${BUTTON_DANGER} self-start`}
            onClick={() => {
              if (window.confirm(t("persons.confirmDelete", { name: person.name })))
                remove.mutate();
            }}
          >
            {t("persons.delete")}
          </button>
          {remove.error && (
            <ErrorText>
              {remove.error instanceof ApiError && remove.error.body.error === "person_in_use"
                ? t("persons.inUse")
                : t("errors.unexpected")}
            </ErrorText>
          )}
        </div>
      )}
    </main>
  );
}
