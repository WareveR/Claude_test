import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";
import { BUTTON } from "../ui/button";

export function RecoverScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const recover = useMutation({
    mutationFn: () => api("/recovery/password", { method: "POST", body: { token, password } }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    recover.mutate();
  }

  return (
    <FormCard title={t("recovery.newPasswordTitle")}>
      {recover.isSuccess ? (
        <>
          <p role="status">{t("recovery.done")}</p>
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() => window.location.assign("/")}
          >
            {t("recovery.continue")}
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
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
          <p className="-mt-2 text-xs text-muted">{t("setup.passwordHint")}</p>
          {recover.error && <ErrorText>{recoverError(recover.error, t)}</ErrorText>}
          <SubmitButton busy={recover.isPending}>{t("recovery.choose")}</SubmitButton>
        </form>
      )}
    </FormCard>
  );
}

function recoverError(error: Error, t: TFunction) {
  if (!(error instanceof ApiError)) return t("errors.network");
  if (error.body.error === "invalid_link") return t("recovery.invalidLink");
  if (error.body.error === "invalid") return t("setup.invalid.password");
  return t("errors.unexpected");
}
