import type { DayWeather } from "../../core/weather";
import { RainChance, WeatherIcon } from "./WeatherIcon";

/**
 * A day's icon with its highest and lowest temperature, and with `rain` its chance of rain;
 * lighter when less certain. `iconOnPhone` leaves only the icon on a phone's narrow screen.
 * `stacked` puts the rain on a second line, so a column of days always takes two lines.
 */
export function WeatherBadge({
  day,
  faded = false,
  size = 18,
  rain = false,
  iconOnPhone = false,
  stacked = false,
  className = "",
}: {
  day: Pick<DayWeather, "code" | "max" | "min" | "rain">;
  faded?: boolean;
  rain?: boolean;
  iconOnPhone?: boolean;
  stacked?: boolean;
  size?: number;
  className?: string;
}) {
  const icon = <WeatherIcon code={day.code} size={size} />;
  const temps = (
    <span className={iconOnPhone ? "max-sm:hidden" : ""}>{`${day.max}°/${day.min}°`}</span>
  );
  const chance =
    rain && day.rain !== undefined ? <RainChance percent={day.rain} size={size - 4} /> : null;
  if (stacked)
    return (
      <span
        className={`inline-flex flex-col items-center whitespace-nowrap tabular-nums ${faded ? "opacity-60" : ""} ${className}`}
      >
        <span className="inline-flex items-center gap-1">
          {icon}
          {temps}
        </span>
        <span className="inline-flex min-h-4 items-center">{chance}</span>
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${faded ? "opacity-60" : ""} ${className}`}
    >
      {icon}
      {temps}
      {chance}
    </span>
  );
}
