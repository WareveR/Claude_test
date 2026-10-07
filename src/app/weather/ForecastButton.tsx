import { useState, type ReactNode } from "react";
import { forecastSite } from "../../core/weather";
import { ForecastDetail } from "./ForecastDetail";
import { useWeather } from "./model";

/**
 * Weather that can be tapped; it opens the weather in detail, which asks before opening the
 * forecast site in a new tab.
 */
export function ForecastButton({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { data } = useWeather();
  const [open, setOpen] = useState(false);
  const site = data ? forecastSite(data.location) : null;
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && data && site && (
        <ForecastDetail data={data} site={site} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
