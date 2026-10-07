import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Droplet,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WeatherKind } from "../../core/weather";
import { weatherKind } from "../../core/weather";

const ICONS: Record<WeatherKind, LucideIcon> = {
  sunny: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  showers: CloudSunRain,
  thunder: CloudLightning,
  snow: CloudSnow,
  fog: CloudFog,
};

/** Each kind's colour, so the icons read at a glance on any theme. */
const COLORS: Record<WeatherKind, string> = {
  sunny: "#f59e0b",
  partlyCloudy: "#eab308",
  cloudy: "#94a3b8",
  rain: "#3b82f6",
  showers: "#0ea5e9",
  thunder: "#8b5cf6",
  snow: "#38bdf8",
  fog: "#9ca3af",
};

/** The coloured line icon for a WMO weather code, named by its kind. */
/** A chance of rain with its own drop icon. */
export function RainChance({ percent, size = 14 }: { percent: number; size?: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" title={t("weather.rainChance")}>
      <Droplet aria-hidden size={size} strokeWidth={2} color="#3b82f6" />
      <span className="sr-only">{t("weather.rainChance")}</span>
      {percent}%
    </span>
  );
}

export function WeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
  const { t } = useTranslation();
  const kind = weatherKind(code);
  const Component = ICONS[kind];
  return (
    <Component
      role="img"
      aria-label={t(`weather.kind.${kind}`)}
      size={size}
      strokeWidth={2}
      color={COLORS[kind]}
    />
  );
}

/** The sunrise and sunset colours, warm like the sunny weather icon. */
export const SUNRISE_COLOR = "#f59e0b";
export const SUNSET_COLOR = "#f97316";

/** Sunrise's coloured line icon, to sit beside its time. */
export function SunriseIcon({ size = 18 }: { size?: number }) {
  return <Sunrise aria-hidden size={size} strokeWidth={2} color={SUNRISE_COLOR} />;
}

/** Sunset's coloured line icon, to sit beside its time. */
export function SunsetIcon({ size = 18 }: { size?: number }) {
  return <Sunset aria-hidden size={size} strokeWidth={2} color={SUNSET_COLOR} />;
}
