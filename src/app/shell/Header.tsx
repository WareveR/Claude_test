import { Lightbulb, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { formatLocale } from "../../core/languages";
import { setDisplayMode, useDisplayMode } from "../display/mode";
import { useSignedIn } from "../family";
import { todayIn } from "../../core/plain-date";
import { ForecastButton } from "../weather/ForecastButton";
import { useForecastDays } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { VoiceEntry } from "../voice/VoiceEntry";
import { paths } from "../paths";
import { useNow } from "./useNow";

/** The last page outside Settings, where the Settings button returns to. */
let outsideSettings: string = paths.today();

/** The fixed header on every view: the time, weekday, day and month in the Family Time Zone. */
export function Header({
  showVoice = true,
}: {
  /** Display Mode hides the microphone. */ showVoice?: boolean;
}) {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const now = useNow();
  // On the wall there is no Settings link and no microphone; a button leaves.
  const wall = useDisplayMode();
  const navigate = useNavigate();
  const location = useLocation();
  const inSettings = location.pathname.startsWith("/settings");
  useEffect(() => {
    if (!inSettings) outsideSettings = location.pathname + location.search;
  }, [inSettings, location.pathname, location.search]);
  const today = useForecastDays().get(todayIn(family.timeZone, now));
  const locale = formatLocale(language);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: family.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: family.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-header px-4 py-2 text-header-ink shadow-sm">
      <time data-testid="header-time" className="text-2xl font-semibold tabular-nums">
        {time}
      </time>
      <span data-testid="header-date" className="first-letter:uppercase">
        {date}
      </span>
      {today && (
        <ForecastButton testId="header-weather" className="rounded-md px-1 py-1 text-sm">
          <WeatherBadge day={today} />
        </ForecastButton>
      )}
      {showVoice && !wall && <VoiceEntry />}
      {wall ? (
        <button
          type="button"
          onClick={() => {
            setDisplayMode(false);
            navigate(paths.today());
          }}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-header-ink/40 px-3 py-1.5 hover:bg-header-ink/15"
        >
          <X aria-hidden size={20} strokeWidth={1.75} />
          {/* On a phone only the cross shows; its name stays for screen readers. */}
          <span className="max-sm:sr-only">{t("display.leave")}</span>
        </button>
      ) : (
        <>
          <Link
            to={paths.suggestions()}
            aria-label={t("suggestions.title")}
            className={`rounded-md p-2 hover:bg-header-ink/15 ${location.pathname === paths.suggestions() ? "bg-header-ink/20" : ""}`}
          >
            <Lightbulb aria-hidden size={20} strokeWidth={1.75} />
          </Link>
          {/* The same button opens Settings and, from inside them, closes them. */}
          <Link
            to={inSettings ? outsideSettings : paths.settings()}
            aria-label={inSettings ? t("settings.close") : t("settings.title")}
            className={`${showVoice ? "" : "ml-auto "}rounded-md p-2 hover:bg-header-ink/15 ${inSettings ? "bg-header-ink/20" : ""}`}
          >
            <Settings aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </>
      )}
    </header>
  );
}
