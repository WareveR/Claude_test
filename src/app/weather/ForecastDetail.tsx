import { ArrowUp, Droplets, ExternalLink, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { moonNow, type MoonPhase } from "../../core/day-notes";
import { formatLocale } from "../../core/languages";
import { formatPlainDate, todayIn } from "../../core/plain-date";
import { compassPoint, placeClock, weatherKind, type CurrentWeather } from "../../core/weather";
import { useSignedIn } from "../family";
import { useAstronomy, useSunTimes } from "../layers/model";
import { useNow } from "../shell/useNow";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { forecastDays, type Weather } from "./model";
import { RainChance, WeatherIcon } from "./WeatherIcon";

const HOURS_SHOWN = 24;
const DAYS_SHOWN = 10;
const MOON_ICONS: Record<MoonPhase, string> = {
  new: "🌑",
  waxingCrescent: "🌒",
  firstQuarter: "🌓",
  waxingGibbous: "🌔",
  full: "🌕",
  waningGibbous: "🌖",
  lastQuarter: "🌗",
  waningCrescent: "🌘",
};

/** Wind: an arrow pointing where it blows and its speed; the compass point in its tooltip. */
function WindReading({ speed, from, size = 14 }: { speed: number; from?: number; size?: number }) {
  const { t } = useTranslation();
  const point = from === undefined ? null : t(`weather.detail.compass.${compassPoint(from)}`);
  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums"
      title={point ? t("weather.detail.windFrom", { point }) : t("weather.detail.wind")}
    >
      {from !== undefined && (
        <ArrowUp
          aria-hidden
          size={size}
          strokeWidth={2.5}
          style={{ transform: `rotate(${from + 180}deg)` }}
        />
      )}
      <span className="sr-only">{t("weather.detail.wind")}</span>
      {speed}
      <span className="text-[0.8em]">km/h</span>
      {point && <span className="sr-only">{point}</span>}
    </span>
  );
}

/** One round indicator under the current conditions, like a dial. */
function Indicator({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="flex size-18 flex-col items-center justify-center rounded-full border-2 border-line bg-surface text-sm font-semibold tabular-nums">
        {icon}
        {children}
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The selected Weather Location's weather in detail: now, the next hours and days, the Sun and
 * the Moon; with Open (the forecast site, in a new tab) and Cancel. Esc closes too.
 */
export function ForecastDetail({
  data,
  site,
  onClose,
}: {
  data: Weather;
  site: { name: string; url: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const now = useNow(60_000);
  const clock = placeClock(data.utcOffset, now);
  const placeToday = clock.slice(0, 10);
  const familyToday = todayIn(family.timeZone, now);
  const sun = useSunTimes(familyToday, true);
  const A = useAstronomy(true);
  const moon = useMemo(
    () => (A ? moonNow(A, now, family.timeZone) : null),
    [A, now, family.timeZone],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hours = data.hourly.filter((h) => h.time >= clock.slice(0, 13)).slice(0, HOURS_SHOWN);
  const thisHour = hours[0];
  // Forecasts fetched before the current conditions were asked for: this hour's instead.
  const current: CurrentWeather | null = data.current ?? thisHour ?? null;
  const days = [...forecastDays(data, placeToday).values()].slice(0, DAYS_SHOWN);
  const today = days[0]?.date === placeToday ? days[0] : undefined;
  const rainNow = thisHour?.rain ?? today?.rain;
  const updated = new Intl.DateTimeFormat(locale, {
    timeZone: family.timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data.fetchedAt));
  const shortDate = (date: string) =>
    formatPlainDate(date, locale, { weekday: "short", day: "numeric", month: "short" });

  // On the body: the header's blur would otherwise trap this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-title"
        data-testid="forecast-detail"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-frame sm:rounded-2xl lg:max-w-4xl"
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id="forecast-title" className="text-lg font-semibold">
              {data.location.name}
            </h2>
            <span className="text-xs text-muted">
              {t("weather.detail.updated", { time: updated })}
            </span>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            {current && (
              <div data-testid="forecast-now" className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <WeatherIcon code={current.code} size={64} />
                  <div className="flex flex-col">
                    <span className="text-5xl font-light tabular-nums">{current.temp}°</span>
                    <span className="text-sm">
                      {t(`weather.kind.${weatherKind(current.code)}`)}
                    </span>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-0.5 text-sm tabular-nums">
                    {today && (
                      <span>{t("weather.detail.maxMin", { max: today.max, min: today.min })}</span>
                    )}
                    {current.feels !== undefined && (
                      <span className="text-muted">
                        {t("weather.detail.feelsLike", { temp: current.feels })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-around gap-3">
                  {current.wind !== undefined && (
                    <Indicator
                      label={
                        current.windDir === undefined
                          ? t("weather.detail.wind")
                          : `${t("weather.detail.wind")} ${t(`weather.detail.compass.${compassPoint(current.windDir)}`)}`
                      }
                      icon={
                        current.windDir === undefined ? (
                          <Wind aria-hidden size={16} />
                        ) : (
                          <ArrowUp
                            aria-hidden
                            size={16}
                            strokeWidth={2.5}
                            style={{ transform: `rotate(${current.windDir + 180}deg)` }}
                          />
                        )
                      }
                    >
                      <span>
                        {current.wind}
                        <span className="text-[0.7em] font-normal"> km/h</span>
                      </span>
                    </Indicator>
                  )}
                  {current.humidity !== undefined && (
                    <Indicator
                      label={t("weather.detail.humidity")}
                      icon={<Droplets aria-hidden size={16} color="#0ea5e9" />}
                    >
                      {current.humidity}%
                    </Indicator>
                  )}
                  {rainNow !== undefined && (
                    <Indicator label={t("weather.rainChance")} icon={null}>
                      <RainChance percent={rainNow} size={16} />
                    </Indicator>
                  )}
                  {today?.uv !== undefined && (
                    <Indicator
                      label={t("weather.detail.uv")}
                      icon={<Sun aria-hidden size={16} color="#f59e0b" />}
                    >
                      {today.uv}
                    </Indicator>
                  )}
                </div>
              </div>
            )}

            <Section title={t("weather.detail.sunMoon")}>
              <div
                data-testid="forecast-sky"
                className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm tabular-nums"
              >
                {sun && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Sunrise aria-hidden size={18} color="#f59e0b" />
                      {t("layers.sunrise")} <strong>{sun.rise ?? "–"}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Sunset aria-hidden size={18} color="#ea580c" />
                      {t("layers.sunset")} <strong>{sun.set ?? "–"}</strong>
                    </span>
                  </div>
                )}
                {moon && (
                  <div data-testid="forecast-moon" className="flex items-start gap-3">
                    <span aria-hidden className="text-3xl leading-none">
                      {MOON_ICONS[moon.phase]}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span>
                        <strong>{t(`weather.detail.moon.${moon.phase}`)}</strong>{" "}
                        <span className="text-muted">
                          {t("weather.detail.moonLit", { percent: moon.lit })}
                        </span>
                      </span>
                      {moon.next.map((n) => (
                        <span key={n.key} className="text-muted">
                          {t("weather.detail.nextPhase", {
                            phase: t(`layers.notes.${n.key}`),
                            date: shortDate(n.date),
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {hours.length > 0 && (
            <Section title={t("weather.detail.hours")}>
              <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {hours.map((h) => (
                  <li
                    key={h.time}
                    data-testid="forecast-hour"
                    className="flex min-w-16 shrink-0 flex-col items-center gap-1 rounded-xl border border-line bg-surface px-2 py-2 text-xs tabular-nums"
                  >
                    <span className="font-semibold">{Number(h.time.slice(11, 13))}h</span>
                    <WeatherIcon code={h.code} size={22} />
                    <span className="text-sm font-semibold">{h.temp}°</span>
                    <RainChance percent={h.rain} size={11} />
                    {h.wind !== undefined && (
                      <span className="text-muted">
                        <WindReading speed={h.wind} from={h.windDir} size={11} />
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {days.length > 0 && (
            <Section title={t("weather.detail.days")}>
              {/* Two columns read top to bottom: today down the first, the later days down the second. */}
              <ol
                className="grid gap-x-6 sm:grid-flow-col sm:grid-cols-2"
                style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 2)}, auto)` }}
              >
                {days.map((d) => (
                  <li
                    key={d.date}
                    data-testid="forecast-day"
                    className={`grid grid-cols-[minmax(5.5rem,1fr)_auto_auto_4.5rem] items-center gap-3 border-b border-line py-1.5 text-sm tabular-nums ${d.faded ? "opacity-60" : ""}`}
                  >
                    <span className="truncate">
                      {d.date === placeToday ? t("weather.detail.today") : shortDate(d.date)}
                    </span>
                    <WeatherIcon code={d.code} size={20} />
                    <span className="flex flex-col text-xs text-muted">
                      {d.rain !== undefined && <RainChance percent={d.rain} size={11} />}
                      {d.wind !== undefined && (
                        <WindReading speed={d.wind} from={d.windDir} size={11} />
                      )}
                    </span>
                    <span className="text-right">
                      <strong>{d.max}°</strong> <span className="text-muted">{d.min}°</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-4 sm:px-5">
          <p className="mr-auto text-sm">{t("weather.confirm", { site: site.name })}</p>
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("weather.cancel")}
          </button>
          <button
            type="button"
            className={BUTTON_PRIMARY}
            onClick={() => {
              window.open(site.url, "_blank", "noopener");
              onClose();
            }}
          >
            <ExternalLink aria-hidden size={16} />
            {t("weather.open")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
