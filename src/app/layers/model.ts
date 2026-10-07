import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { dayNotes, sunTimes, type DayNote, type Layer } from "../../core/day-notes";
import type { PlainDate } from "../../core/plain-date";
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
};

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
  const { family } = useSignedIn();
  const { layers } = usePersonFilter();
  const place = useWeather().data?.location ?? null;
  const A = useAstronomy(layers.some((l) => l !== "sun"));
  const label = useNoteLabel();
  const notes = useMemo(
    () =>
      A
        ? dayNotes(A, { from, to, timeZone: family.timeZone, layers, place })
        : new Map<PlainDate, DayNote[]>(),
    [A, from, to, family.timeZone, layers, place],
  );
  return new Map([...notes].map(([date, list]) => [date, list.map(label)]));
}

/** Sunrise and sunset at the Weather Location on a day, when the Sun Layer is on. */
export function useSunTimes(day: PlainDate): { rise: string | null; set: string | null } | null {
  const { family } = useSignedIn();
  const { layers } = usePersonFilter();
  const place = useWeather().data?.location ?? null;
  const on = layers.includes("sun") && place !== null;
  const A = useAstronomy(on);
  return useMemo(
    () => (A && on && place ? sunTimes(A, day, family.timeZone, place) : null),
    [A, on, place, day, family.timeZone],
  );
}
