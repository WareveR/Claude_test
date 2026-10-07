import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";

/** A new recovery email only takes effect once its inbox confirms it. */
export function RecoveryEmailSection() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => api("/recovery-email", { method: "POST", body: { password, email } }),
    onSuccess: () => {
      setSentTo(email);
      setPassword("");
      setEmail("");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setSentTo(null);
    change.mutate();
  }

  const error = change.error;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("recovery.emailTitle")}</h2>
      <p className="text-xs text-muted">{t("recovery.emailHint")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t("password.current")}>
          <TextInput
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t("recovery.emailNew")}>
          <TextInput
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {sentTo && <p role="status">{t("recovery.emailSent", { email: sentTo })}</p>}
        {error && (
          <ErrorText>
            {!(error instanceof ApiError)
              ? t("errors.network")
              : error.body.error === "wrong_password"
                ? t("signIn.wrong")
                : error.body.error === "too_many_attempts"
                  ? t("signIn.tooMany", { seconds: error.body.retryAfter })
                  : error.body.error === "invalid"
                    ? t("setup.invalid.recoveryEmail")
                    : t("errors.unexpected")}
          </ErrorText>
        )}
        <SubmitButton busy={change.isPending}>{t("recovery.emailChange")}</SubmitButton>
      </form>
    </section>
  );
}
