import { useTranslation } from "react-i18next";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { useSunTimes } from "../layers/model";

function minutes(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** Today's sunrise, sunset and hours of daylight at the Weather Location. */
export function SunBand() {
  const { t } = useTranslation();
  const today = todayIn(useSignedIn().family.timeZone);
  const sun = useSunTimes(today, true);
  if (!sun || (!sun.rise && !sun.set)) return null;
  const length = sun.rise && sun.set ? minutes(sun.set) - minutes(sun.rise) : null;
  return (
    <div
      data-testid="sun-band"
      className="mx-4 flex flex-wrap items-center justify-around gap-x-4 gap-y-1 rounded-md border border-line px-3 py-2 text-sm tabular-nums"
    >
      <span>
        <span aria-hidden>🌅</span> {t("layers.sunrise")} <strong>{sun.rise ?? "–"}</strong>
      </span>
      <span>
        <span aria-hidden>🌇</span> {t("layers.sunset")} <strong>{sun.set ?? "–"}</strong>
      </span>
      {length !== null && length > 0 && (
        <span className="text-muted">
          {t("layers.daylight", {
            hours: Math.floor(length / 60),
            minutes: String(length % 60).padStart(2, "0"),
          })}
        </span>
      )}
    </div>
  );
}
