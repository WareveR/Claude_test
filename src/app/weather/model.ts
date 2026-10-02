import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { addDays, todayIn, type PlainDate } from "../../core/plain-date";
import {
  CERTAIN_DAYS,
  FORECAST_DAYS,
  type DayWeather,
  type HourWeather,
  type WeatherPlace,
} from "../../core/weather";
import { api } from "../api";
import { useSignedIn } from "../family";

export type WeatherLocation = WeatherPlace & { id: string };
export type Weather = {
  location: Pick<WeatherLocation, "id" | "name" | "countryCode" | "latitude" | "longitude">;
  fetchedAt: string;
  utcOffset: number;
  daily: DayWeather[];
  hourly: HourWeather[];
};
export type WeatherLocations = { locations: WeatherLocation[]; selectedId: string | null };
/** A day's forecast; `faded` from the 8th day on, when it is less certain. */
export type ShownDay = DayWeather & { faded: boolean };

/** The selected place's forecast, or null when there is none. */
export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: () => api<Weather | null>("/weather"),
  });
}

export function useWeatherLocations() {
  return useQuery({
    queryKey: ["weather-locations"],
    queryFn: () => api<WeatherLocations>("/weather/locations"),
  });
}

/** The forecast by date, from the Family's today for 15 days; empty for past days or none. */
export function forecastDays(forecast: Weather | null | undefined, today: PlainDate) {
  const days = new Map<PlainDate, ShownDay>();
  const last = addDays(today, FORECAST_DAYS - 1);
  for (const day of forecast?.daily ?? []) {
    if (day.date < today || day.date > last) continue;
    const index = days.size;
    days.set(day.date, { ...day, faded: index >= CERTAIN_DAYS });
  }
  return days;
}

export function useForecastDays(): Map<PlainDate, ShownDay> {
  const { family } = useSignedIn();
  const { data } = useWeather();
  const today = todayIn(family.timeZone);
  return useMemo(() => forecastDays(data, today), [data, today]);
}
