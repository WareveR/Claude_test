import { CloudSun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setWeatherShown, useWeatherShown } from "./compact";

/** Shows or hides the weather in the day, week and month views and on the Wall. */
export function WeatherButton() {
  const { t } = useTranslation();
  const shown = useWeatherShown();
  return (
    <button
      type="button"
      aria-label={shown ? t("views.hideWeather") : t("views.showWeather")}
      aria-pressed={shown}
      data-testid="weather-toggle"
      data-help="weatherToggle"
      onClick={() => setWeatherShown(!shown)}
      className={`rounded-md p-1.5 ${shown ? "bg-accent text-accent-ink" : "hover:bg-line/60"}`}
    >
      <CloudSun aria-hidden size={20} strokeWidth={1.75} />
    </button>
  );
}
