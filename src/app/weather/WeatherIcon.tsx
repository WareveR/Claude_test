import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Sun,
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

/** The line icon for a WMO weather code, named by its kind. */
export function WeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
  const { t } = useTranslation();
  const kind = weatherKind(code);
  const Component = ICONS[kind];
  return (
    <Component role="img" aria-label={t(`weather.kind.${kind}`)} size={size} strokeWidth={1.75} />
  );
}
