import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";

/** Opened from an invite email: the new adult chooses a password and is signed in. */
export function InviteScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const accept = useMutation({
    mutationFn: () => api("/invite/accept", { method: "POST", body: { token, password } }),
    onSuccess: () => window.location.assign("/"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    accept.mutate();
  }

  return (
    <FormCard title={t("invite.title")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">{t("invite.hint")}</p>
        <Field label={t("invite.password")}>
          <TextInput
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">{t("setup.passwordHint")}</p>
        {accept.error && <ErrorText>{acceptError(accept.error, t)}</ErrorText>}
        <SubmitButton busy={accept.isPending}>{t("invite.accept")}</SubmitButton>
      </form>
    </FormCard>
  );
}

function acceptError(error: Error, t: TFunction) {
  if (!(error instanceof ApiError)) return t("errors.network");
  if (error.body.error === "invalid_link") return t("invite.invalidLink");
  if (error.body.error === "invalid") return t("setup.invalid.password");
  return t("errors.unexpected");
}
