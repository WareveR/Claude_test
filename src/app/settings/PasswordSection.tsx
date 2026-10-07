import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";

/** Changing the Family Password signs out every device, this one too. */
export function PasswordSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const change = useMutation({
    mutationFn: () => api("/password", { method: "POST", body: { currentPassword, newPassword } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (window.confirm(t("password.confirm"))) change.mutate();
  }

  const error = change.error;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("password.title")}</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t("password.current")}>
          <TextInput
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label={t("password.new")}>
          <TextInput
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">{t("password.hint")}</p>
        {error && (
          <ErrorText>
            {error instanceof ApiError && error.body.error === "wrong_password"
              ? t("signIn.wrong")
              : error instanceof ApiError && error.body.error === "too_many_attempts"
                ? t("signIn.tooMany", { seconds: error.body.retryAfter })
                : error instanceof ApiError && error.body.error === "invalid"
                  ? t("setup.invalid.password")
                  : t("errors.unexpected")}
          </ErrorText>
        )}
        <SubmitButton busy={change.isPending}>{t("password.submit")}</SubmitButton>
      </form>
    </section>
  );
}
