import { placeClock } from "../../core/weather";
import { useNow } from "../shell/useNow";
import { ForecastButton } from "./ForecastButton";
import { useWeather } from "./model";
import { WeatherIcon } from "./WeatherIcon";

/** Today's remaining hours in the place's own clock: spread across wide screens, scrolling sideways on narrow ones. */
export function HourlyStrip() {
  const { data } = useWeather();
  const now = useNow(60_000);
  if (!data) return null;
  const clock = placeClock(data.utcOffset, now);
  const from = clock.slice(0, 13);
  const hours = data.hourly.filter((h) => h.time.startsWith(clock.slice(0, 10)) && h.time >= from);
  if (hours.length === 0) return null;
  return (
    <div data-testid="hourly-strip" className="px-4">
      <ForecastButton className="flex w-full gap-3 overflow-x-auto rounded-md border border-line py-2 px-2 text-left">
        {hours.map((h) => (
          <span
            key={h.time}
            data-testid="hour-cell"
            className="flex min-w-10 flex-1 shrink-0 basis-0 flex-col items-center gap-0.5 text-xs tabular-nums"
          >
            <span className="text-muted">{h.time.slice(11, 13)}</span>
            <WeatherIcon code={h.code} />
            <span>{h.temp}°</span>
            <span className="text-muted">{h.rain}%</span>
          </span>
        ))}
      </ForecastButton>
    </div>
  );
}
