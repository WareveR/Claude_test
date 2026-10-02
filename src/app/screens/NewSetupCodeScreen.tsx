import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";

export function NewSetupCodeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [setupCode, setSetupCode] = useState("");
  const [password, setPassword] = useState("");
  const setPasswordMutation = useMutation({
    mutationFn: () => api("/setup/password", { method: "POST", body: { setupCode, password } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setPasswordMutation.mutate();
  }

  return (
    <FormCard title={t("recovery.newSetupCodeTitle")}>
      <p className="text-sm">{t("recovery.newSetupCodeHint")}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("setup.setupCode")}>
          <TextInput
            required
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("recovery.newPassword")}>
          <TextInput
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {setPasswordMutation.error && (
          <ErrorText>{newSetupCodeError(setPasswordMutation.error, t)}</ErrorText>
        )}
        <SubmitButton busy={setPasswordMutation.isPending}>{t("recovery.choose")}</SubmitButton>
      </form>
    </FormCard>
  );
}

function newSetupCodeError(error: Error, t: TFunction) {
  if (!(error instanceof ApiError)) return t("errors.network");
  if (error.body.error === "wrong_setup_code") return t("setup.wrongCode");
  if (error.body.error === "too_many_attempts")
    return t("signIn.tooMany", { seconds: error.body.retryAfter });
  if (error.body.error === "invalid") return t("setup.invalid.password");
  return t("errors.unexpected");
}
