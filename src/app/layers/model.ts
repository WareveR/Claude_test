import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { dayNotes, sunTimes, type DayNote, type Layer } from "../../core/day-notes";
import { addDays, weekday, type PlainDate } from "../../core/plain-date";
import { binsOn } from "../../core/waste";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { useWeather } from "../weather/model";

/** `astronomy-engine` is large, so it loads on first use rather than with the app. */
function useAstronomy(needed: boolean) {
  return useQuery({
    queryKey: ["astronomy-engine"],
    queryFn: () => import("astronomy-engine"),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: needed,
  }).data;
}

const ICONS: Record<string, string> = {
  "moon.new": "🌑",
  "moon.firstQuarter": "🌓",
  "moon.full": "🌕",
  "moon.lastQuarter": "🌗",
  "season.spring": "🌸",
  "season.summer": "☀️",
  "season.autumn": "🍂",
  "season.winter": "❄️",
};
const LAYER_ICONS: Record<Layer, string> = {
  school: "🎒",
  moon: "🌙",
  seasons: "🌿",
  clock: "🕑",
  special: "💝",
  sky: "✨",
  sun: "🌅",
  waste: "🗑️",
};

/** Layers worked out from the Family's settings alone, without `astronomy-engine`. */
const PLAIN: Layer[] = ["sun", "waste"];

/** A note as a short line: an icon, the name in the device's language, and its time if any. */
function useNoteLabel() {
  const { t } = useTranslation();
  return (note: DayNote) =>
    `${ICONS[note.key] ?? LAYER_ICONS[note.layer]} ${t(`layers.notes.${note.key}`)}${note.time ? ` ${note.time}` : ""}`;
}

/**
 * The window's Calendar Layer notes by date, as short labelled lines; empty until this device
 * turns a Layer on in the Person Filter panel. Calculated here, never stored.
 */
export function useDayNotes(from: PlainDate, to: PlainDate): Map<PlainDate, string[]> {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const { layers } = usePersonFilter();
  const place = useWeather().data?.location ?? null;
  const A = useAstronomy(layers.some((l) => !PLAIN.includes(l)));
  const label = useNoteLabel();
  const notes = useMemo(
    () =>
      A
        ? dayNotes(A, { from, to, timeZone: family.timeZone, layers, place })
        : new Map<PlainDate, DayNote[]>(),
    [A, from, to, family.timeZone, layers, place],
  );
  const lines = new Map([...notes].map(([date, list]) => [date, list.map(label)]));
  if (layers.includes("waste")) {
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const bins = binsOn(family.wasteCollection, weekday(day));
      if (bins.length === 0) continue;
      const names = bins.map((bin) => t(`waste.bins.${bin}`)).join(", ");
      const line = `${LAYER_ICONS.waste} ${t("layers.notes.waste.collection", { bins: names })}`;
      lines.set(day, [...(lines.get(day) ?? []), line]);
    }
  }
  return lines;
}

/**
 * Sunrise and sunset at the Weather Location on a day, when the Sun Layer is on,
 * or always when `always` is set.
 */
export function useSunTimes(
  day: PlainDate,
  always = false,
): { rise: string | null; set: string | null } | null {
  const { family } = useSignedIn();
  const { layers } = usePersonFilter();
  const place = useWeather().data?.location ?? null;
  const on = (always || layers.includes("sun")) && place !== null;
  const A = useAstronomy(on);
  return useMemo(
    () => (A && on && place ? sunTimes(A, day, family.timeZone, place) : null),
    [A, on, place, day, family.timeZone],
  );
}
