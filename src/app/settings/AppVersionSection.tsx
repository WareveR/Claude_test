import { useQuery } from "@tanstack/react-query";
import { BellRing, ChevronDown, RefreshCw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { Release } from "../../core/release-number";
import { APP_VERSION } from "../../core/version";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { api, ApiError } from "../api";
import { DEV_TOOLS } from "../environment";
import { useSignedIn } from "../family";
import { updateNow } from "../offline/service-worker";
import { BUTTON } from "../ui/button";

/** What this device gives the app to draw on, so a page that looks too big or too small can be explained. */
function screenLine(): string {
  const installed = window.matchMedia("(display-mode: standalone)").matches;
  return [
    `${window.innerWidth}×${window.innerHeight}`,
    `${screen.width}×${screen.height}`,
    `${Math.round(window.devicePixelRatio * 100) / 100}`,
    installed ? "app" : "browser",
  ].join(" · ");
}

function onResize(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}

/**
 * Every version and what it brought, newest first, in a box about ten rows tall that scrolls; read
 * from the build only once opened.
 */
function VersionHistory() {
  const { t, i18n } = useTranslation();
  const { language } = useSignedIn();
  const locale = formatLocale(language);
  const [open, setOpen] = useState(false);
  const releases = useQuery({
    queryKey: ["releases"],
    queryFn: async () => {
      const res = await fetch("/releases.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Release[];
    },
    enabled: open,
    staleTime: Infinity,
  });
  const portuguese = i18n.language.startsWith("pt");
  return (
    <details
      className="group rounded-md border border-line"
      data-testid="version-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
        <ChevronDown
          aria-hidden
          size={16}
          className="-rotate-90 transition-transform group-open:rotate-0"
        />
        {t("settings.app.history")}
      </summary>
      {releases.isError && (
        <p className="px-3 pb-2 text-sm text-muted">{t("settings.app.historyNone")}</p>
      )}
      {releases.data?.length === 0 && (
        <p className="px-3 pb-2 text-sm text-muted">{t("settings.app.historyNone")}</p>
      )}
      {releases.data && releases.data.length > 0 && (
        <div className="max-h-[26rem] overflow-y-auto border-t border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>
                <th className="px-2 py-1.5 font-medium">{t("settings.app.columns.version")}</th>
                <th className="px-2 py-1.5 font-medium">{t("settings.app.columns.date")}</th>
                <th className="px-2 py-1.5 font-medium max-sm:hidden">
                  {t("settings.app.columns.kind")}
                </th>
                <th className="px-2 py-1.5 font-medium">{t("settings.app.columns.what")}</th>
                <th className="px-2 py-1.5 font-medium">{t("settings.app.columns.pr")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {releases.data.map((release) => (
                <tr key={release.version} data-testid="version-row" className="align-top">
                  <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">v{release.version}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted tabular-nums">
                    {formatPlainDate(release.date, locale, { day: "2-digit", month: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5 max-sm:hidden">
                    {t(`settings.app.kinds.${release.kind}`)}
                  </td>
                  <td className="px-2 py-1.5">{(portuguese && release.notePt) || release.title}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {release.pr ? (
                      <a
                        href={`https://github.com/WareveR/Claude_test/pull/${release.pr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline"
                      >
                        #{release.pr}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

type TestState = "idle" | "sending" | "sent" | "noPush" | "notSetUp" | "failed";

/** Tests and diagnostics, on the test copy only and closed by default: the screen this device draws on and a test notification. */
function Diagnostics() {
  const { t } = useTranslation();
  const screenSize = useSyncExternalStore(onResize, screenLine, () => "");
  const [test, setTest] = useState<TestState>("idle");
  const sendTest = async () => {
    setTest("sending");
    try {
      await api("/device/push/test", { method: "POST", body: {} });
      setTest("sent");
    } catch (error) {
      const code = error instanceof ApiError ? error.body.error : undefined;
      setTest(code === "noPush" || code === "notSetUp" ? code : "failed");
    }
  };
  return (
    <details className="group rounded-md border border-line" data-testid="diagnostics">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
        <ChevronDown
          aria-hidden
          size={16}
          className="-rotate-90 transition-transform group-open:rotate-0"
        />
        {t("settings.app.diagnostics")}
      </summary>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-2">
        <p data-testid="screen-size" className="text-sm text-muted">
          {t("settings.app.screen", { screen: screenSize })}
        </p>
        <button
          type="button"
          className={`${BUTTON} self-start`}
          disabled={test === "sending"}
          onClick={sendTest}
        >
          <BellRing aria-hidden size={16} />
          {t("settings.app.testPush")}
        </button>
        {test !== "idle" && test !== "sending" && (
          <p role="status" className="text-sm text-muted">
            {t(`settings.app.testPushResult.${test}`)}
          </p>
        )}
      </div>
    </details>
  );
}

/** Settings › App version: which version this device runs, a button to update it now, and the list of versions. */
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
      <VersionHistory />
      {DEV_TOOLS && <Diagnostics />}
    </section>
  );
}
