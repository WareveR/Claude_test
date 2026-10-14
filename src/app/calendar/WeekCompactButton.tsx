import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setWeekCompact, useWeekCompact } from "./compact";

/** Hides or shows the week's weather and day notes, so the hours get the room. */
export function WeekCompactButton() {
  const { t } = useTranslation();
  const compact = useWeekCompact();
  return (
    <button
      type="button"
      aria-label={compact ? t("views.showWeather") : t("views.hideWeather")}
      aria-pressed={compact}
      data-testid="week-compact"
      onClick={() => setWeekCompact(!compact)}
      className="rounded-md p-1.5 hover:bg-line/60"
    >
      {compact ? (
        <ChevronsUpDown aria-hidden size={20} strokeWidth={1.75} />
      ) : (
        <ChevronsDownUp aria-hidden size={20} strokeWidth={1.75} />
      )}
    </button>
  );
}
