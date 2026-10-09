import type { DayWeather } from "../../core/weather";
import { RainChance, WeatherIcon } from "./WeatherIcon";

/**
 * A day's icon with its highest and lowest temperature, and with `rain` its chance of rain;
 * lighter when less certain. `iconOnPhone` leaves only the icon on a phone's narrow screen.
 */
export function WeatherBadge({
  day,
  faded = false,
  size = 18,
  rain = false,
  iconOnPhone = false,
  className = "",
}: {
  day: Pick<DayWeather, "code" | "max" | "min" | "rain">;
  faded?: boolean;
  rain?: boolean;
  iconOnPhone?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${faded ? "opacity-60" : ""} ${className}`}
    >
      <WeatherIcon code={day.code} size={size} />
      <span className={iconOnPhone ? "max-sm:hidden" : ""}>
        {day.max}°/{day.min}°
      </span>
      {rain && day.rain !== undefined && <RainChance percent={day.rain} size={size - 4} />}
    </span>
  );
}
