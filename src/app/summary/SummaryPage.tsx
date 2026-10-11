import { useTranslation } from "react-i18next";
import { TodayPanel } from "../shell/SidePanel";

/** The Summary: today's weather by the hour, sunrise and sunset, and "Coming up", on its own. */
export function SummaryPage() {
  const { t } = useTranslation();
  return (
    <main
      data-testid="summary"
      className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-3"
      aria-label={t("screens.summary")}
    >
      <TodayPanel />
    </main>
  );
}
