import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormActions, TextInput } from "../screens/form";
import { PERSON_COLORS, uploadPhoto, usePersons, type Person } from "./model";
import { PersonAvatar } from "./PersonAvatar";
import { readyToEdit } from "../offline/fresh";

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
  const [form, setForm] = useState({
    name: person?.name ?? "",
    color: person?.color ?? PERSON_COLORS[0],
    photoKey: person?.photoKey ?? null,
    dateOfBirth: person?.dateOfBirth ?? "",
    nicknames: person?.nicknames.join(", ") ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["persons"] });
    // A date of birth keeps the Person's Birthday Entry in sync.
    await queryClient.invalidateQueries({ queryKey: ["entries"] });
    navigate("/settings");
  };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        color: form.color,
        photoKey: form.photoKey,
        dateOfBirth: form.dateOfBirth || null,
        nicknames: form.nicknames.split(","),
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
        <Link to="/settings" className="text-sm underline">
          {t("settings.back")}
        </Link>
        <h1 className="text-xl font-semibold">{person ? person.name : t("persons.add")}</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar person={{ ...form, name: form.name || "?" }} size={64} />
          <label className="text-sm underline">
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
              className="text-sm underline"
              onClick={() => setForm({ ...form, photoKey: null })}
            >
              {t("persons.removePhoto")}
            </button>
          )}
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
              <label key={color} className="cursor-pointer">
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
                  className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-stone-900 dark:peer-checked:ring-stone-100"
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
        <p className="-mt-2 text-xs text-stone-500">{t("persons.nicknamesHint")}</p>
        {save.error && <ErrorText>{t("errors.unexpected")}</ErrorText>}
        <FormActions
          busy={save.isPending || uploading}
          saveLabel={t("persons.save")}
          cancelLabel={t("settings.cancel")}
          onCancel={() => navigate("/settings")}
        />
      </form>
      {person && (
        <div className="flex flex-col gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
          <button
            type="button"
            className="self-start underline"
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
          <p className="text-xs text-stone-500">{t("persons.archiveHint")}</p>
          <button
            type="button"
            className="self-start text-red-700 underline dark:text-red-400"
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
