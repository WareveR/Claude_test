import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { formatLocale } from "../../core/languages";
import { api } from "../api";
import { useSignedIn } from "../family";
import { BUTTON } from "../ui/button";

type LoggedError = {
  code: string;
  at: string;
  source: "device" | "server";
  deviceName: string | null;
  appVersion: string;
  action: string;
  message: string;
  comment: string | null;
};

/** Settings › Error log: the last 90 days of failures from every device and the Worker. */
export function ErrorLogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { family, language } = useSignedIn();
  const errors = useQuery({ queryKey: ["errors"], queryFn: () => api<LoggedError[]>("/errors") });
  const when = new Intl.DateTimeFormat(formatLocale(language), {
    timeZone: family.timeZone,
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button type="button" className={BUTTON} onClick={() => navigate(-1)}>
          <ChevronLeft aria-hidden size={16} />
          {t("settings.back")}
        </button>
        <h1 className="text-xl font-semibold">{t("errors.log.title")}</h1>
      </div>
      {errors.data?.length === 0 && <p className="text-sm text-muted">{t("errors.log.empty")}</p>}
      <ul className="flex flex-col gap-2">
        {errors.data?.map((error) => (
          <li key={error.code} className="rounded-md border border-line p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono font-medium">{error.code}</span>
              <span className="text-xs text-muted">{when.format(new Date(error.at))}</span>
              <span className="text-xs text-muted">
                {error.deviceName ?? t("errors.log.server")} · {error.appVersion}
              </span>
            </div>
            <p className="break-all text-xs">{error.action}</p>
            <p className="break-all text-xs text-muted">{error.message}</p>
            {error.comment && (
              <p className="mt-1 text-xs">{t("errors.log.comment", { comment: error.comment })}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
