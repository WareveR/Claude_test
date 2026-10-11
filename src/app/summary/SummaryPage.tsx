import { useTranslation } from "react-i18next";
import { TodayTasks } from "../briefing/ComingUp";
import { TodayPanel } from "../shell/SidePanel";
import { WeekEntries } from "./WeekEntries";

/**
 * The Summary: today's weather by the hour, sunrise and sunset and "Coming up" on the left, and the
 * next seven days' Entries and what is left to do on the right; one under the other on a narrow
 * screen.
 */
export function SummaryPage() {
  const { t } = useTranslation();
  return (
    <main
      data-testid="summary"
      className="mx-auto grid w-full max-w-6xl gap-3 py-3 md:grid-cols-[3fr_2fr] md:items-start"
      aria-label={t("screens.summary")}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <TodayPanel />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <WeekEntries />
        <TodayTasks />
      </div>
    </main>
  );
}
