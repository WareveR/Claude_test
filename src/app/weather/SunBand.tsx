import { useTranslation } from "react-i18next";
import { minutesNowIn, todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { useSunTimes } from "../layers/model";
import { useNow } from "../shell/useNow";
import { SUNRISE_COLOR, SunriseIcon, SunsetIcon } from "./WeatherIcon";

function minutes(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/**
 * Today's sunrise, sunset and hours of daylight at the Weather Location, on one slim line: the
 * sun on a track between the two times, the part of the day already gone filled in.
 */
export function SunBand() {
  const { t } = useTranslation();
  const { timeZone } = useSignedIn().family;
  const now = useNow(60_000);
  const today = todayIn(timeZone, now);
  const sun = useSunTimes(today, true);
  if (!sun || (!sun.rise && !sun.set)) return null;
  const rise = sun.rise ? minutes(sun.rise) : null;
  const length = rise !== null && sun.set ? minutes(sun.set) - rise : null;
  const daylight = length !== null && length > 0 ? length : null;
  return (
    <div
      data-testid="sun-band"
      className="mx-4 flex items-center gap-3 rounded-md border border-line px-3 py-2 text-sm tabular-nums"
    >
      <span className="inline-flex shrink-0 items-center gap-1">
        <SunriseIcon size={16} />
        <span className="sr-only">{t("layers.sunrise")}</span> <strong>{sun.rise ?? "–"}</strong>
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
        {rise !== null && daylight !== null && (
          <SunTrack share={(minutesNowIn(timeZone, now) - rise) / daylight} />
        )}
        {daylight !== null && (
          <span className="text-xs text-muted">
            {t("layers.daylight", {
              hours: Math.floor(daylight / 60),
              minutes: String(daylight % 60).padStart(2, "0"),
            })}
          </span>
        )}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1">
        <span className="sr-only">{t("layers.sunset")}</span> <strong>{sun.set ?? "–"}</strong>
        <SunsetIcon size={16} />
      </span>
    </div>
  );
}

/** The track: the day gone so far filled in, and the sun where it is now (at an end by night). */
function SunTrack({ share }: { share: number }) {
  const at = Math.min(1, Math.max(0, share)) * 100;
  const up = share > 0 && share < 1;
  return (
    <span aria-hidden className="relative block h-1 w-full rounded-full bg-line">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${at}%`, backgroundColor: SUNRISE_COLOR }}
      />
      <span
        data-testid="sun-dot"
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{
          left: `${at}%`,
          borderColor: SUNRISE_COLOR,
          backgroundColor: up ? SUNRISE_COLOR : "var(--color-bg)",
        }}
      />
    </span>
  );
}
