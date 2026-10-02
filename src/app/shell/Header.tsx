import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatLocale } from "../../core/languages";
import { useSignedIn } from "../family";
import { useNow } from "./useNow";

/** The fixed header on every view: the time, weekday, day and month in the Family Time Zone. */
export function Header() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const now = useNow();
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
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <time data-testid="header-time" className="text-2xl font-semibold tabular-nums">
        {time}
      </time>
      <span data-testid="header-date" className="first-letter:uppercase">
        {date}
      </span>
      <Link
        to="/settings"
        aria-label={t("settings.title")}
        className="ml-auto rounded-md p-2 hover:bg-stone-200 dark:hover:bg-stone-800"
      >
        <Settings aria-hidden size={20} strokeWidth={1.75} />
      </Link>
    </header>
  );
}
