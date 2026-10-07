import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Navigate, useParams } from "react-router";
import { ChevronLeft, LogOut } from "lucide-react";
import { LANGUAGES } from "../../core/languages";
import { api } from "../api";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { EntryTypesSection } from "../entry-types/EntryTypesSection";
import { HolidaysSection } from "./HolidaysSection";
import { VoiceSection } from "./VoiceSection";
import { WasteSection } from "./WasteSection";
import { WeatherSection } from "./WeatherSection";
import { ExportSection } from "./ExportSection";
import { RemindersSection } from "./RemindersSection";
import { FeedsSection } from "./FeedsSection";
import { PersonsSection } from "../persons/PersonsSection";
import { DevicesSection } from "./DevicesSection";
import { PasswordSection } from "./PasswordSection";
import { RecoveryEmailSection } from "./RecoveryEmailSection";
import { setTheme, THEMES, useTheme, type Theme } from "../theme";
import { BUTTON } from "../ui/button";

/** Settings come in four areas, each with its own address. */
export const SETTINGS_AREAS = ["family", "calendar", "device", "account"] as const;
type Area = (typeof SETTINGS_AREAS)[number];

/**
 * Settings: a side menu of areas with Sign out always at its foot. Wide screens show the menu
 * beside the open area; phones show the menu alone at /settings and one area per page.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const { area } = useParams();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => api("/session", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  if (area !== undefined && !SETTINGS_AREAS.includes(area as Area)) {
    return <Navigate to={paths.settings()} replace />;
  }
  // Without an area, wide screens open the first one beside the menu.
  const open: Area = (area as Area | undefined) ?? "family";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:flex-row md:gap-8">
      <nav
        aria-label={t("settings.title")}
        className={`flex flex-col gap-1 md:w-56 md:shrink-0 ${area ? "hidden md:flex" : ""}`}
      >
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
        </div>
        {SETTINGS_AREAS.map((a) => (
          <NavLink
            key={a}
            to={paths.settingsArea(a)}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 ${isActive || (!area && a === open) ? "md:bg-accent md:text-accent-ink" : "hover:bg-line/60"} border border-line md:border-0`
            }
          >
            {t(`settings.areas.${a}`)}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => signOut.mutate()}
          className="mt-4 flex items-center gap-2 self-start rounded-md border border-overdue px-3 py-2 font-medium text-overdue"
        >
          <LogOut aria-hidden size={18} strokeWidth={1.75} />
          {t("signIn.signOut")}
        </button>
      </nav>
      <section
        aria-label={t(`settings.areas.${open}`)}
        className={`flex min-w-0 flex-1 flex-col gap-6 ${area ? "" : "hidden md:flex"}`}
      >
        <div className="flex items-center gap-3">
          <Link to={paths.settings()} className={`${BUTTON} md:hidden`}>
            <ChevronLeft aria-hidden size={16} />
            {t("settings.title")}
          </Link>
          <h2 className="text-xl font-semibold">{t(`settings.areas.${open}`)}</h2>
        </div>
        <AreaContent area={open} />
      </section>
    </main>
  );
}

function AreaContent({ area }: { area: Area }) {
  const { t } = useTranslation();
  switch (area) {
    case "family":
      return (
        <>
          <PersonsSection />
          <EntryTypesSection />
        </>
      );
    case "calendar":
      return (
        <>
          <HolidaysSection />
          <WeatherSection />
          <WasteSection />
          <RemindersSection />
          <FeedsSection />
        </>
      );
    case "device":
      return (
        <>
          <DeviceLooks />
          <VoiceSection />
        </>
      );
    case "account":
      return (
        <>
          <PasswordSection />
          <RecoveryEmailSection />
          <DevicesSection />
          <ExportSection />
          <Link to={paths.errorLog()} className={`${BUTTON} self-start`}>
            {t("errors.log.open")}
          </Link>
        </>
      );
  }
}

/** This device's language and colour theme. */
function DeviceLooks() {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const changeLanguage = useMutation({
    mutationFn: (lng: string) => api("/device", { method: "PATCH", body: { language: lng } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("settings.language")}</span>
        <select
          value={language}
          onChange={(e) => changeLanguage.mutate(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2"
        >
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {t(`languages.${lng}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("settings.theme")}</span>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="rounded-md border border-line bg-surface px-3 py-2"
        >
          {THEMES.map((th) => (
            <option key={th} value={th}>
              {t(`themes.${th}`)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
