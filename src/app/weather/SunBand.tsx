import { useTranslation } from "react-i18next";
import { minutesNowIn, todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { useSunTimes } from "../layers/model";
import { useNow } from "../shell/useNow";
import { SUNRISE_COLOR, SunriseIcon, SunsetIcon } from "./WeatherIcon";

function minutes(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** The day's arc in the drawing: a half ellipse standing on the horizon. */
const CX = 100;
const HORIZON = 58;
const RX = 84;
const RY = 48;
const ARC = `M${CX - RX},${HORIZON} A${RX},${RY} 0 0 1 ${CX + RX},${HORIZON}`;

/** Where the sun sits on the arc once `share` (0 at sunrise, 1 at sunset) of the day has gone. */
function onArc(share: number): { x: number; y: number } {
  const angle = Math.PI * (1 - share);
  return {
    x: Number((CX + RX * Math.cos(angle)).toFixed(1)),
    y: Number((HORIZON - RY * Math.sin(angle)).toFixed(1)),
  };
}

/**
 * Today's sunrise, sunset and hours of daylight at the Weather Location: the sun on its arc
 * between the two, the part of the day already gone drawn solid and the rest dashed.
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
      className="mx-4 rounded-md border border-line px-3 py-2 text-sm tabular-nums"
    >
      <div className="mx-auto flex max-w-xs flex-col">
        {rise !== null && daylight !== null && (
          <SunArc share={(minutesNowIn(timeZone, now) - rise) / daylight} />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1">
            <SunriseIcon />
            <span className="sr-only">{t("layers.sunrise")}</span>{" "}
            <strong>{sun.rise ?? "–"}</strong>
          </span>
          {daylight !== null && (
            <span className="text-center text-xs text-muted">
              {t("layers.daylight", {
                hours: Math.floor(daylight / 60),
                minutes: String(daylight % 60).padStart(2, "0"),
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="sr-only">{t("layers.sunset")}</span> <strong>{sun.set ?? "–"}</strong>
            <SunsetIcon />
          </span>
        </div>
      </div>
    </div>
  );
}

/** The drawing: horizon, the day's arc, and the sun where it is now (resting at an end by night). */
function SunArc({ share }: { share: number }) {
  const up = share > 0 && share < 1;
  const sun = onArc(Math.min(1, Math.max(0, share)));
  return (
    <svg viewBox="0 0 200 64" className="h-auto w-full" aria-hidden>
      <line x1="4" x2="196" y1={HORIZON} y2={HORIZON} className="stroke-line" strokeWidth="1.5" />
      <path
        d={ARC}
        fill="none"
        className="stroke-muted"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      {share > 0 && (
        <path
          d={`M${CX - RX},${HORIZON} A${RX},${RY} 0 0 1 ${sun.x},${sun.y}`}
          fill="none"
          stroke={SUNRISE_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {up && <circle cx={sun.x} cy={sun.y} r="10" fill={SUNRISE_COLOR} fillOpacity="0.25" />}
      <circle
        data-testid="sun-dot"
        cx={sun.x}
        cy={sun.y}
        r="5.5"
        fill={up ? SUNRISE_COLOR : "none"}
        stroke={SUNRISE_COLOR}
        strokeWidth="2"
      />
    </svg>
  );
}
