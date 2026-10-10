import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../../core/version";
import { updateNow } from "../offline/service-worker";
import { BUTTON } from "../ui/button";

/** Settings › App version: which version this device runs, and a button to update it now. */
export function AppVersionSection() {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "checking" | "updating" | "latest">("idle");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("settings.app.title")}</h2>
      <p className="text-sm text-muted">{t("settings.app.version", { version: APP_VERSION })}</p>
      <button
        type="button"
        className={`${BUTTON} self-start`}
        disabled={state === "checking" || state === "updating"}
        onClick={async () => {
          setState("checking");
          setState(await updateNow().catch(() => "latest" as const));
        }}
      >
        <RefreshCw aria-hidden size={16} className={state === "checking" ? "animate-spin" : ""} />
        {state === "checking"
          ? t("settings.app.checking")
          : state === "updating"
            ? t("settings.app.updating")
            : t("settings.app.update")}
      </button>
      {state === "latest" && (
        <p role="status" className="text-sm text-muted">
          {t("settings.app.latest")}
        </p>
      )}
    </section>
  );
}
