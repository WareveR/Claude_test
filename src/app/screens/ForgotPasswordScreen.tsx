import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { ErrorText, Field, FormCard, SubmitButton, TextInput } from "./form";
import { BUTTON } from "../ui/button";

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const send = useMutation({
    mutationFn: () => api("/recovery", { method: "POST", body: { email } }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    send.mutate();
  }

  return (
    <FormCard title={t("recovery.title")}>
      {send.isSuccess ? (
        <p role="status">{t("recovery.sent")}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("recovery.email")}>
            <TextInput
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {send.error && <ErrorText>{t("errors.network")}</ErrorText>}
          <SubmitButton busy={send.isPending}>{t("recovery.send")}</SubmitButton>
        </form>
      )}
      <button type="button" className={`${BUTTON} self-start`} onClick={onBack}>
        {t("recovery.back")}
      </button>
    </FormCard>
  );
}
