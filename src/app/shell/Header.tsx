import { Lightbulb, Plus, Search, Settings, Tv, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { formatLocale } from "../../core/languages";
import { leaveDisplayMode, setDisplayMode, useDisplayMode } from "../display/mode";
import { useSignedIn } from "../family";
import { isPlainDate, todayIn, type PlainDate } from "../../core/plain-date";
import { focusedDay } from "../views/focus";
import { ForecastButton } from "../weather/ForecastButton";
import { useForecastDays } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { VoiceEntry } from "../voice/VoiceEntry";
import { paths } from "../paths";
import { useNow } from "./useNow";
import { MonthMotif } from "../month-theme";
import { TEST_SITE } from "../environment";

/** The last page outside Settings and Suggestions, where their buttons return to. */
let outsideSettings: string = paths.today();
/**
 * The last calendar page (outside the Wall, the Summary, Settings and Suggestions), where switching
 * the Wall off returns to.
 */
let outsideScreens: string = paths.today();

/** Where "+" leads: a new Entry on the day view's day, else on the day in focus, else today. */
function newPath(pathname: string, today: PlainDate): string {
  const [, view, date] = pathname.split("/");
  const day = view === "day" && date && isPlainDate(date) ? date : (focusedDay() ?? today);
  return `/entries/new?date=${day}`;
}

/** An on/off switch at the end of the header for a screen of its own: the Wall. */
function ScreenSwitch({
  on,
  icon: Icon,
  label,
  help,
  onToggle,
  className = "",
}: {
  on: boolean;
  icon: LucideIcon;
  label: string;
  help: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-help={help}
      onClick={onToggle}
      className={`${className} flex shrink-0 items-center gap-1.5 rounded-md border p-1 sm:px-3 sm:py-1.5 ${on ? "border-header-ink bg-header-ink/25" : "border-header-ink/40 hover:bg-header-ink/15"}`}
    >
      <Icon aria-hidden size={20} strokeWidth={1.75} />
      {/* On a phone only the icon shows; its name stays for screen readers. */}
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
}

/** The fixed header on every view: the time, weekday, day and month in the Family Time Zone. */
export function Header({
  showVoice = true,
  month = null,
}: {
  /** Display Mode hides the microphone. */ showVoice?: boolean;
  /** With the Month theme, the month whose drawing the header carries. */
  month?: number | null;
}) {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const now = useNow();
  // On the wall there is no Settings link and no microphone; its switch turns it off.
  const wall = useDisplayMode();
  const navigate = useNavigate();
  const location = useLocation();
  const inSettings = location.pathname.startsWith("/settings");
  const inSuggestions = location.pathname === paths.suggestions();
  const inSummary = location.pathname === paths.summary();
  useEffect(() => {
    if (!inSettings && !inSuggestions) outsideSettings = location.pathname + location.search;
    if (!wall && !inSummary && !inSettings && !inSuggestions)
      outsideScreens = location.pathname + location.search;
  }, [inSettings, inSuggestions, inSummary, wall, location.pathname, location.search]);
  // Switched off, the page from before comes back. The Summary is a button of the Wall's own.
  const toggleWall = () => {
    if (wall) return leaveDisplayMode(outsideScreens);
    setDisplayMode(true);
    navigate(paths.display());
  };
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
  // On a phone: three letters and the day's number, so the header always stays one line.
  const shortDate = [
    new Intl.DateTimeFormat(locale, { timeZone: family.timeZone, weekday: "short" })
      .format(now)
      .replace(".", "")
      .slice(0, 3),
    new Intl.DateTimeFormat(locale, { timeZone: family.timeZone, day: "numeric" }).format(now),
  ].join(" ");

  return (
    <header className="sticky top-0 z-10 flex items-center gap-1 bg-header px-2 py-2 text-header-ink shadow-sm sm:gap-3 sm:px-4 short:py-1">
      <time
        data-testid="header-time"
        className="shrink-0 text-2xl font-semibold tabular-nums short:text-xl"
      >
        {time}
      </time>
      <span data-testid="header-date" className="min-w-0 first-letter:uppercase">
        <span className="max-sm:hidden">{date}</span>
        <span className="whitespace-nowrap sm:hidden">{shortDate}</span>
      </span>
      {/* The test copy says so on every page, so it is never taken for the Family's calendar. */}
      {TEST_SITE && (
        <span
          data-testid="test-site"
          className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-black uppercase"
        >
          {t("app.testSite")}
        </span>
      )}
      {today && (
        <ForecastButton
          testId="header-weather"
          help="weather"
          className="shrink-0 rounded-md px-1 py-1 text-sm whitespace-nowrap"
        >
          <WeatherBadge day={today} iconOnPhone />
        </ForecastButton>
      )}
      {showVoice && !wall && <VoiceEntry />}
      {!wall && (
        <>
          <Link
            to={paths.search()}
            aria-label={t("search.title")}
            data-help="search"
            className={`${showVoice ? "" : "ml-auto "}shrink-0 rounded-md p-1 hover:bg-header-ink/15 sm:p-2`}
          >
            <Search aria-hidden size={20} strokeWidth={1.75} />
          </Link>
          {/* A new Entry or Task on the day shown, or the day in focus in the other views. */}
          <Link
            to={newPath(location.pathname, todayIn(family.timeZone, now))}
            onClick={(event) => {
              // The view below may have moved the focus since the header drew.
              event.preventDefault();
              navigate(newPath(location.pathname, todayIn(family.timeZone, now)));
            }}
            aria-label={t("newItem.title")}
            data-help="newEntry"
            className="shrink-0 rounded-full bg-header-ink/20 p-1 hover:bg-header-ink/30 sm:p-1.5"
          >
            <Plus aria-hidden size={20} strokeWidth={2} />
          </Link>
          {/* Like Settings: the same button opens Suggestions and, from inside, closes them. */}
          <Link
            to={inSuggestions ? outsideSettings : paths.suggestions()}
            aria-label={inSuggestions ? t("suggestions.close") : t("suggestions.title")}
            data-help={inSuggestions ? "close" : "suggestions"}
            className={`shrink-0 rounded-md p-1 hover:bg-header-ink/15 sm:p-2 ${inSuggestions ? "bg-header-ink/20" : ""}`}
          >
            <Lightbulb aria-hidden size={20} strokeWidth={1.75} />
          </Link>
          {/* The same button opens Settings and, from inside them, closes them. */}
          <Link
            to={inSettings ? outsideSettings : paths.settings()}
            aria-label={inSettings ? t("settings.close") : t("settings.title")}
            data-help={inSettings ? "close" : "settings"}
            className={`shrink-0 rounded-md p-1 hover:bg-header-ink/15 sm:p-2 ${inSettings ? "bg-header-ink/20" : ""}`}
          >
            <Settings aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </>
      )}
      {/* Always last and in the same place, on the wall too. */}
      <ScreenSwitch
        on={wall}
        icon={Tv}
        label={t("screens.wall")}
        help="wall"
        onToggle={toggleWall}
        className={wall ? "ml-auto" : ""}
      />
      {month !== null && (
        <MonthMotif month={month} opacity={0.16} className="absolute inset-0 text-header-ink" />
      )}
    </header>
  );
}
