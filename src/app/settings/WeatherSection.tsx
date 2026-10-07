import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_WEATHER_LOCATIONS, type WeatherPlace } from "../../core/weather";
import { api } from "../api";
import { Field, TextInput } from "../screens/form";
import { useWeatherLocations } from "../weather/model";
import { BUTTON } from "../ui/button";

const describe = (place: WeatherPlace) =>
  [place.name, place.admin, place.country].filter(Boolean).join(", ");

const samePlace = (a: WeatherPlace, b: WeatherPlace) =>
  a.latitude === b.latitude && a.longitude === b.longitude;

/** The Family's Weather Locations: where the forecast is for, chosen once for every device. */
export function WeatherSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useWeatherLocations();
  const [town, setTown] = useState("");
  const done = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weather"] }),
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] }),
    ]);
  const search = useMutation({
    mutationFn: (q: string) => api<WeatherPlace[]>(`/weather/search?q=${encodeURIComponent(q)}`),
  });
  const save = useMutation({
    mutationFn: (place: WeatherPlace) => api("/weather/locations", { method: "POST", body: place }),
    onSuccess: () => search.reset(),
    onSettled: done,
  });
  const select = useMutation({
    mutationFn: (id: string) => api("/weather/selected", { method: "PUT", body: { id } }),
    onSettled: done,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/weather/locations/${id}`, { method: "DELETE" }),
    onSettled: done,
  });

  const locations = data?.locations ?? [];
  const full = locations.length >= MAX_WEATHER_LOCATIONS;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("weather.title")}</h2>
      <p className="text-sm text-muted">{t("weather.hint")}</p>
      {locations.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {locations.map((place) => {
            const name = describe(place);
            return (
              <li key={place.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{name}</span>
                <span className="flex items-center gap-3">
                  {place.id === data?.selectedId ? (
                    <span className="text-sm text-muted">{t("weather.selected")}</span>
                  ) : (
                    <button
                      type="button"
                      className={BUTTON}
                      aria-label={t("weather.usePlace", { name })}
                      onClick={() => select.mutate(place.id)}
                    >
                      {t("weather.use")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={BUTTON}
                    aria-label={t("weather.removePlace", { name })}
                    onClick={() => remove.mutate(place.id)}
                  >
                    {t("weather.remove")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {full ? (
        <p className="text-sm text-muted">{t("weather.full", { max: MAX_WEATHER_LOCATIONS })}</p>
      ) : (
        <>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (town.trim().length >= 2) search.mutate(town.trim());
            }}
          >
            <Field label={t("weather.town")}>
              <TextInput value={town} onChange={(e) => setTown(e.target.value)} />
            </Field>
            <button
              type="submit"
              disabled={search.isPending}
              className="self-start rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
            >
              {t("weather.search")}
            </button>
          </form>
          {search.isError && <p className="text-sm text-muted">{t("weather.searchFailed")}</p>}
          {search.data?.length === 0 && (
            <p className="text-sm text-muted">{t("weather.noResults")}</p>
          )}
          {search.data && search.data.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {search.data.map((place) => {
                const name = describe(place);
                return (
                  <li
                    key={`${place.latitude},${place.longitude}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      className={BUTTON}
                      aria-label={t("weather.savePlace", { name })}
                      disabled={save.isPending || locations.some((l) => samePlace(l, place))}
                      onClick={() => save.mutate(place)}
                    >
                      {t("weather.save")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
