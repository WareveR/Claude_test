import type { ReactNode } from "react";
import { placeClock, type HourWeather } from "../../core/weather";
import { useNow } from "../shell/useNow";
import { ForecastButton } from "./ForecastButton";
import { useWeather } from "./model";
import { RainChance, WeatherIcon } from "./WeatherIcon";

const HOURS_SHOWN = 24;

/**
 * The next 24 hours in the place's own clock, as in the forecast detail, or the given `hours` of one day,
 * as a row of fixed-width hour cards: they share out a wide row and scroll sideways in a narrow
 * one, never squeezing into each other. A `lead` (the day's sunrise and sunset) stays put on the left.
 */
export function HourlyStrip({ hours: given, lead }: { hours?: HourWeather[]; lead?: ReactNode }) {
  const { data } = useWeather();
  const now = useNow(60_000);
  if (!data && !given) return null;
  const clock = data ? placeClock(data.utcOffset, now) : "";
  const hours =
    given ?? (data?.hourly ?? []).filter((h) => h.time >= clock.slice(0, 13)).slice(0, HOURS_SHOWN);
  if (hours.length === 0) return null;
  return (
    <div data-testid="hourly-strip" className="flex px-4">
      {lead && (
        <div className="flex shrink-0 items-center rounded-l-md border border-r-0 border-line bg-surface px-1.5">
          {lead}
        </div>
      )}
      <div
        className={`relative min-w-0 flex-1 overflow-x-auto overscroll-x-contain border border-line bg-surface [scrollbar-width:thin] ${lead ? "rounded-r-md" : "rounded-md"}`}
      >
        <ForecastButton className="flex w-max min-w-full gap-1 p-1 text-left">
          {hours.map((h) => (
            <span
              key={h.time}
              data-testid="hour-cell"
              className="flex w-14 shrink-0 grow flex-col items-center gap-1 rounded-md py-1.5 text-xs tabular-nums"
            >
              <span className="font-semibold text-muted">{Number(h.time.slice(11, 13))}h</span>
              <WeatherIcon code={h.code} size={22} />
              <span className="text-sm font-semibold">{h.temp}°</span>
              <span className="text-muted">
                <RainChance percent={h.rain} size={12} />
              </span>
            </span>
          ))}
        </ForecastButton>
      </div>
    </div>
  );
}
