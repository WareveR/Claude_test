import type { Language } from "./languages";
import { formatPlainDate, type PlainDate } from "./plain-date";
import { weatherKind, type DayWeather, type HourWeather, type WeatherKind } from "./weather";

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

const TEXTS: Record<
  Language,
  {
    kinds: Record<WeatherKind, string>;
    temps: (min: number, max: number) => string;
    rain: (chance: number) => string;
    around: (time: string) => string;
    noRain: string;
    unknown: string;
    none: string;
    in: (place: string) => string;
  }
> = {
  "pt-PT": {
    kinds: {
      sunny: "sol",
      partlyCloudy: "algumas nuvens",
      cloudy: "céu nublado",
      rain: "chuva",
      showers: "aguaceiros",
      thunder: "trovoada",
      snow: "neve",
      fog: "nevoeiro",
    },
    temps: (min, max) => `entre ${min} e ${max} graus`,
    rain: (chance) => `${chance}% de probabilidade de chuva`,
    around: (time) => `mais provável por volta das ${time}`,
    noRain: "não deve chover",
    unknown: "Ainda não há previsão para esse dia.",
    none: "Não há previsão do tempo: escolha um local em Definições.",
    in: (place) => `em ${place}`,
  },
  en: {
    kinds: {
      sunny: "sunny",
      partlyCloudy: "some clouds",
      cloudy: "cloudy",
      rain: "rain",
      showers: "showers",
      thunder: "thunderstorms",
      snow: "snow",
      fog: "fog",
    },
    temps: (min, max) => `between ${min} and ${max} degrees`,
    rain: (chance) => `${chance}% chance of rain`,
    around: (time) => `most likely around ${time}`,
    noRain: "no rain expected",
    unknown: "There is no forecast for that day yet.",
    none: "There is no weather forecast: choose a place in Settings.",
    in: (place) => `in ${place}`,
  },
};

/**
 * "Friday 9 October in Lisbon: rain, between 12 and 18 degrees, 80% chance of rain, most likely
 * around 15:00." — the answer to "will it rain tomorrow?".
 */
export function weatherAnswer(
  date: PlainDate,
  forecast: { place: string; days: DayWeather[]; hours: HourWeather[] } | null,
  language: Language,
): string {
  const texts = TEXTS[language];
  if (!forecast) return texts.none;
  const day = forecast.days.find((d) => d.date === date);
  if (!day) return texts.unknown;
  const label = formatPlainDate(date, LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hours = forecast.hours.filter((h) => h.time.startsWith(date));
  const wettest = hours.reduce<HourWeather | null>(
    (best, h) => (!best || h.rain > best.rain ? h : best),
    null,
  );
  const chance = day.rain ?? wettest?.rain ?? 0;
  const parts = [
    texts.kinds[weatherKind(day.code)],
    texts.temps(Math.round(day.min), Math.round(day.max)),
    chance >= 20 ? texts.rain(chance) : texts.noRain,
    chance >= 20 && wettest && wettest.rain >= 20 ? texts.around(wettest.time.slice(11, 16)) : "",
  ];
  return `${label} ${texts.in(forecast.place)}: ${parts.filter(Boolean).join(", ")}.`;
}
