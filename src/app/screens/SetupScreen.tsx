import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../../core/languages";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";

const TIME_ZONES = Intl.supportedValuesOf("timeZone");

export function SetupScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    setupCode: "",
    name: "",
    password: "",
    recoveryEmail: "",
    language: i18n.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const setup = useMutation({
    mutationFn: () => api("/setup", { method: "POST", body: form }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    setup.mutate();
  }

  return (
    <FormCard title={t("setup.title")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("setup.setupCode")}>
          <TextInput
            required
            value={form.setupCode}
            onChange={update("setupCode")}
            autoComplete="off"
          />
        </Field>
        <Field label={t("setup.familyName")}>
          <TextInput required value={form.name} onChange={update("name")} />
        </Field>
        <Field label={t("setup.password")}>
          <TextInput
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={form.password}
            onChange={update("password")}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">{t("setup.passwordHint")}</p>
        <Field label={t("setup.recoveryEmail")}>
          <TextInput
            required
            type="email"
            value={form.recoveryEmail}
            onChange={update("recoveryEmail")}
          />
        </Field>
        <Field label={t("setup.language")}>
          <select
            value={form.language}
            onChange={update("language")}
            className="rounded-md border border-line bg-surface px-3 py-2"
          >
            {LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {t(`languages.${lng}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("setup.timeZone")}>
          <select
            value={form.timeZone}
            onChange={update("timeZone")}
            className="rounded-md border border-line bg-surface px-3 py-2"
          >
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
        {setup.error && <ErrorText>{setupError(setup.error, t)}</ErrorText>}
        <SubmitButton busy={setup.isPending}>{t("setup.submit")}</SubmitButton>
      </form>
    </FormCard>
  );
}

function setupError(error: Error, t: TFunction) {
  if (!(error instanceof ApiError)) return t("errors.network");
  if (error.body.error === "wrong_setup_code") return t("setup.wrongCode");
  if (error.body.error === "too_many_attempts")
    return t("signIn.tooMany", { seconds: error.body.retryAfter });
  if (error.body.error === "invalid") return t(`setup.invalid.${error.body.field}`);
  return t("errors.unexpected");
}
