import { placeClock, type HourWeather } from "../../core/weather";
import { useNow } from "../shell/useNow";
import { ForecastButton } from "./ForecastButton";
import { useWeather } from "./model";
import { RainChance, WeatherIcon } from "./WeatherIcon";

/**
 * Today's remaining hours in the place's own clock, or the given `past` hours of a day gone by:
 * spread across wide screens, scrolling sideways on narrow ones.
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
      <ForecastButton className="flex w-full gap-3 overflow-x-auto rounded-md border border-line py-2 px-2 text-left">
        {hours.map((h) => (
          <span
            key={h.time}
            data-testid="hour-cell"
            className="flex min-w-12 flex-1 shrink-0 basis-0 flex-col items-center gap-0.5 text-xs tabular-nums lg:flex-row lg:justify-center lg:gap-2 lg:text-sm"
          >
            <span className="font-semibold">{Number(h.time.slice(11, 13))}h</span>
            <WeatherIcon code={h.code} size={20} />
            <span>{h.temp}°</span>
            <span className="text-muted">
              <RainChance percent={h.rain} size={12} />
            </span>
          </span>
        ))}
      </ForecastButton>
    </div>
  );
}
