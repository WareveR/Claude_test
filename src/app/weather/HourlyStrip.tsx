import { placeClock, type HourWeather } from "../../core/weather";
import { useNow } from "../shell/useNow";
import { ForecastButton } from "./ForecastButton";
import { useWeather } from "./model";
import { RainChance, WeatherIcon } from "./WeatherIcon";

/**
 * Today's remaining hours in the place's own clock, or the given `past` hours of a day gone by,
 * as a row of fixed-width hour cards: they share out a wide row and scroll sideways in a narrow
 * one, never squeezing into each other.
 */
export function HourlyStrip({ past }: { past?: HourWeather[] }) {
  const { data } = useWeather();
  const now = useNow(60_000);
  if (!data && !past) return null;
  const clock = data ? placeClock(data.utcOffset, now) : "";
  const hours =
    past ??
    (data?.hourly ?? []).filter(
      (h) => h.time.startsWith(clock.slice(0, 10)) && h.time >= clock.slice(0, 13),
    );
  if (hours.length === 0) return null;
  return (
    <div data-testid="hourly-strip" className="px-4">
      <div className="relative overflow-x-auto overscroll-x-contain rounded-md border border-line bg-surface [scrollbar-width:thin]">
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
