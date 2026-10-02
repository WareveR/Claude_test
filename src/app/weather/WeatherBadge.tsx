import type { DayWeather } from "../../core/weather";
import { WeatherIcon } from "./WeatherIcon";

/** A day's icon with its highest and lowest temperature; lighter when less certain. */
export function WeatherBadge({
  day,
  faded = false,
  size = 18,
  className = "",
}: {
  day: Pick<DayWeather, "code" | "max" | "min">;
  faded?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${faded ? "opacity-60" : ""} ${className}`}
    >
      <WeatherIcon code={day.code} size={size} />
      <span>
        {day.max}°/{day.min}°
      </span>
    </span>
  );
}
