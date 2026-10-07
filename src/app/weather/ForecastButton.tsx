import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { forecastSite } from "../../core/weather";
import { useWeather } from "./model";

/** Weather that can be tapped; it asks before opening the forecast site in a new tab. */
export function ForecastButton({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { t } = useTranslation();
  const { data } = useWeather();
  const [asking, setAsking] = useState(false);
  const site = data ? forecastSite(data.location) : null;
  const button = "rounded-md border border-line px-4 py-2";
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        className={className}
        onClick={() => setAsking(true)}
      >
        {children}
      </button>
      {asking &&
        site &&
        // On the body: the header's blur would otherwise trap this fixed overlay.
        createPortal(
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="forecast-title"
              className="flex w-full max-w-sm flex-col gap-2 rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
            >
              <h2 id="forecast-title" className="font-semibold">
                {t("weather.confirm", { site: site.name })}
              </h2>
              <button
                type="button"
                className={button}
                onClick={() => {
                  window.open(site.url, "_blank", "noopener");
                  setAsking(false);
                }}
              >
                {t("weather.open")}
              </button>
              <button
                type="button"
                className="mt-1 self-end text-sm underline"
                onClick={() => setAsking(false)}
              >
                {t("weather.cancel")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
