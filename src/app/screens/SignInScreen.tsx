import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";

export function SignInScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => api("/session", { method: "POST", body: { password } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    signIn.mutate();
  }

  return (
    <FormCard title={t("signIn.title")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("signIn.password")}>
          <TextInput
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {signIn.error && <ErrorText>{signInError(signIn.error, t)}</ErrorText>}
        <SubmitButton busy={signIn.isPending}>{t("signIn.submit")}</SubmitButton>
      </form>
    </FormCard>
  );
}

function signInError(error: Error, t: TFunction) {
  if (!(error instanceof ApiError)) return t("errors.network");
  if (error.body.error === "wrong_password") return t("signIn.wrong");
  if (error.body.error === "too_many_attempts")
    return t("signIn.tooMany", { seconds: error.body.retryAfter });
  return t("errors.unexpected");
}
