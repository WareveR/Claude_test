import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LANGUAGES } from "../../core/languages";
import { api } from "../api";
import { useSignedIn } from "../family";
import { paths } from "../paths";
import { EntryTypesSection } from "../entry-types/EntryTypesSection";
import { HolidaysSection } from "./HolidaysSection";
import { PersonsSection } from "../persons/PersonsSection";
import { DevicesSection } from "./DevicesSection";
import { PasswordSection } from "./PasswordSection";

export function SettingsPage() {
  const { t } = useTranslation();
  const { language } = useSignedIn();
  const queryClient = useQueryClient();
  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ["status"] });
  const changeLanguage = useMutation({
    mutationFn: (lng: string) => api("/device", { method: "PATCH", body: { language: lng } }),
    onSuccess: refreshStatus,
  });
  const signOut = useMutation({
    mutationFn: () => api("/session", { method: "DELETE" }),
    onSuccess: refreshStatus,
  });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <Link to={paths.today()} className="text-sm underline">
          {t("settings.back")}
        </Link>
        <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("settings.language")}</span>
        <select
          value={language}
          onChange={(e) => changeLanguage.mutate(e.target.value)}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-900"
        >
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {t(`languages.${lng}`)}
            </option>
          ))}
        </select>
      </label>
      <PersonsSection />
      <EntryTypesSection />
      <HolidaysSection />
      <DevicesSection />
      <PasswordSection />
      <button type="button" className="self-start underline" onClick={() => signOut.mutate()}>
        {t("signIn.signOut")}
      </button>
    </main>
  );
}
