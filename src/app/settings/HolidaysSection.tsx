import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_HOLIDAY_PLACES, type HolidayPlace } from "../../core/holidays";
import { api } from "../api";
import { useSignedIn } from "../family";
import { Field } from "../screens/form";

const SELECT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

const samePlace = (a: HolidayPlace, b: HolidayPlace) =>
  a.country === b.country && a.state === b.state && a.region === b.region;

/** The Family's Public Holiday places: where its holidays are calculated for. */
export function HolidaysSection() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const lang = language.slice(0, 2);
  const queryClient = useQueryClient();
  const { data: Holidays } = useQuery({
    queryKey: ["date-holidays"],
    queryFn: async () => (await import("date-holidays")).default,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const save = useMutation({
    mutationFn: (places: HolidayPlace[]) =>
      api("/family/holidays", { method: "PUT", body: { places } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");

  const places = family.holidayPlaces;
  const library = Holidays ? new Holidays() : undefined;
  const countries = library?.getCountries(lang) ?? {};
  const states = country ? (library?.getStates(country, lang) ?? {}) : {};
  const regions = country && state ? (library?.getRegions(country, state, lang) ?? {}) : {};
  const hasStates = Object.keys(states).length > 0;
  const hasRegions = hasStates && Object.keys(regions).length > 0;

  const candidate: HolidayPlace = {
    country,
    ...(state && { state }),
    ...(state && region && { region }),
  };
  const canAdd =
    country !== "" &&
    places.length < MAX_HOLIDAY_PLACES &&
    !places.some((p) => samePlace(p, candidate));

  const describe = (place: HolidayPlace) =>
    [
      countries[place.country] ?? place.country,
      place.state && (library?.getStates(place.country, lang)?.[place.state] ?? place.state),
      place.state &&
        place.region &&
        (library?.getRegions(place.country, place.state, lang)?.[place.region] ?? place.region),
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("holidays.title")}</h2>
      <p className="text-sm text-muted">{t("holidays.hint")}</p>
      {library && (
        <>
          <ul className="divide-y divide-line rounded-md border border-line">
            {places.map((place) => {
              const name = describe(place);
              return (
                <li
                  key={`${place.country}/${place.state ?? ""}/${place.region ?? ""}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    className="text-sm underline"
                    aria-label={t("holidays.removePlace", { name })}
                    onClick={() => save.mutate(places.filter((p) => !samePlace(p, place)))}
                  >
                    {t("holidays.remove")}
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canAdd) return;
              save.mutate([...places, candidate]);
              setCountry("");
              setState("");
              setRegion("");
            }}
          >
            <Field label={t("holidays.country")}>
              <select
                className={SELECT}
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setState("");
                  setRegion("");
                }}
              >
                <option value="" />
                {Object.entries(countries).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            {hasStates && (
              <Field label={t("holidays.state")}>
                <select
                  className={SELECT}
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setRegion("");
                  }}
                >
                  <option value="">{t("holidays.none")}</option>
                  {Object.entries(states).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {hasRegions && (
              <Field label={t("holidays.region")}>
                <select
                  className={SELECT}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">{t("holidays.none")}</option>
                  {Object.entries(regions).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <button
              type="submit"
              disabled={!canAdd || save.isPending}
              className="self-start rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {t("holidays.add")}
            </button>
          </form>
          <p className="text-sm text-muted">{t("holidays.municipalityHint")}</p>
        </>
      )}
    </section>
  );
}
