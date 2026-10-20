import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { useSignedIn } from "../family";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { BUTTON } from "../ui/button";

/**
 * Leaving the wall asks the password of the Account it is signed in with, so a child at the
 * tablet can't reach everything that Account sees.
 */
export function LeaveWallDialog({
  onLeave,
  onClose,
}: {
  onLeave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const [password, setPassword] = useState("");
  const check = useMutation({
    mutationFn: () => api("/account/password-check", { method: "POST", body: { password } }),
    onSuccess: onLeave,
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    check.mutate();
  }

  const error = check.error;
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-wall-title"
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-2xl bg-frame p-5 sm:rounded-2xl"
      >
        <h2 id="leave-wall-title" className="text-lg font-semibold">
          {t("display.leaveTitle")}
        </h2>
        <p className="text-sm text-muted">{t("display.leaveHint", { email: account.email })}</p>
        <Field label={t("display.leavePassword")}>
          <TextInput
            required
            autoFocus
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
                : t("errors.network")}
          </ErrorText>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.back")}
          </button>
          <SubmitButton busy={check.isPending}>{t("display.leave")}</SubmitButton>
        </div>
      </form>
    </div>,
    document.body,
  );
}
