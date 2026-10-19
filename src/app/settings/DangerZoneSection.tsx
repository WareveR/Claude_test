import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { RESET_PARTS, type ResetPart } from "../../core/reset";
import { api, ApiError } from "../api";
import { useSignedIn } from "../family";
import { ErrorText, Field, TextInput } from "../screens/form";
import { BUTTON, BUTTON_DANGER } from "../ui/button";
import { downloadExport } from "./ExportSection";

/**
 * Settings › Danger zone: deletes the ticked kinds of data for good, or everything at once to
 * start again as a new Family. The password is checked first, then the full Export is saved on
 * this device, and only then is anything deleted. The password and devices always stay.
 */
export function DangerZoneSection() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const queryClient = useQueryClient();
  const [parts, setParts] = useState<ResetPart[]>([]);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const reset = useMutation({
    mutationFn: async () => {
      await api("/reset", { method: "POST", body: { password, parts, check: true } });
      await downloadExport(family.timeZone);
      await api("/reset", { method: "POST", body: { password, parts } });
    },
    onSuccess: async () => {
      setParts([]);
      setPassword("");
      setDone(true);
      await queryClient.invalidateQueries();
    },
  });

  const everything = parts.length === RESET_PARTS.length;
  const toggle = (part: ResetPart, on: boolean) => {
    setDone(false);
    setParts(
      on
        ? RESET_PARTS.filter((p) => p === part || parts.includes(p))
        : parts.filter((p) => p !== part),
    );
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (parts.length > 0 && window.confirm(t(everything ? "reset.confirmAll" : "reset.confirm"))) {
      reset.mutate();
    }
  }

  const error = reset.error;
  return (
    <section
      aria-labelledby="danger-zone"
      className="flex flex-col gap-3 rounded-lg border-2 border-overdue p-4"
    >
      <h2 id="danger-zone" className="font-semibold text-overdue">
        {t("reset.title")}
      </h2>
      <p className="text-sm text-muted">{t("reset.hint")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("reset.choose")}</legend>
          {RESET_PARTS.map((part) => (
            <label key={part} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={parts.includes(part)}
                onChange={(e) => toggle(part, e.target.checked)}
              />
              <span>
                <span className="font-medium">{t(`reset.parts.${part}`)}</span>
                <span className="block text-sm text-muted">{t(`reset.details.${part}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className={`${BUTTON} self-start`}
          onClick={() => {
            setDone(false);
            setParts(everything ? [] : [...RESET_PARTS]);
          }}
        >
          {everything ? t("reset.none") : t("reset.all")}
        </button>
        {parts.length > 0 && (
          <>
            <p className="text-sm">{t("reset.before")}</p>
            <Field label={t("reset.password")}>
              <TextInput
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <ErrorText>
                {error instanceof ApiError && error.body.error === "wrong_password"
                  ? t("password.wrong")
                  : error instanceof ApiError && error.body.error === "too_many_attempts"
                    ? t("signIn.tooMany", { seconds: error.body.retryAfter })
                    : t("errors.unexpected")}
              </ErrorText>
            )}
            <button
              type="submit"
              disabled={reset.isPending}
              className={`${BUTTON_DANGER} self-start font-semibold`}
            >
              {reset.isPending
                ? t("reset.deleting")
                : everything
                  ? t("reset.submitAll")
                  : t("reset.submit", { count: parts.length })}
            </button>
          </>
        )}
        {done && (
          <p role="status" className="text-sm font-medium">
            {t("reset.done")}
          </p>
        )}
      </form>
    </section>
  );
}
