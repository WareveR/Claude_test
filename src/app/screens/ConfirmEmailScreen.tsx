import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { FormCard } from "./form";

export function ConfirmEmailScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const started = useRef(false);
  const confirm = useMutation({
    mutationFn: () => api("/recovery-email/confirm", { method: "POST", body: { token } }),
  });
  const { mutate } = confirm;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  const message = confirm.isSuccess
    ? t("recovery.confirmed")
    : confirm.error
      ? confirm.error instanceof ApiError && confirm.error.body.error === "invalid_link"
        ? t("recovery.invalidLink")
        : t("errors.unexpected")
      : t("recovery.confirming");

  return (
    <FormCard title={t("recovery.confirmTitle")}>
      <p role="status">{message}</p>
      {(confirm.isSuccess || confirm.isError) && (
        <button
          type="button"
          className="self-start underline"
          onClick={() => window.location.assign("/")}
        >
          {t("recovery.continue")}
        </button>
      )}
    </FormCard>
  );
}
