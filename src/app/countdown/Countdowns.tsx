import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Countdown } from "../../core/countdown";
import { useCountdowns, useMarkCountdown } from "./model";

/** "Natal · 38 dias": the next three things the Family counts the days to, on the Wall. */
export function CountdownStrip() {
  const { t } = useTranslation();
  const items = useCountdowns().data?.items ?? [];
  if (items.length === 0) return null;
  const days = (c: Countdown) =>
    c.days === 0
      ? t("countdown.today")
      : c.days === 1
        ? t("countdown.tomorrow")
        : t("countdown.days", { count: c.days });
  return (
    <ul
      data-testid="countdowns"
      aria-label={t("countdown.title")}
      className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-1 text-sm max-sm:px-2"
    >
      {items.map((c) => (
        <li key={`${c.kind}-${c.entryId}-${c.date}`} className="flex min-w-0 items-center gap-1.5">
          <Hourglass aria-hidden size={14} className="shrink-0 text-muted" />
          <span className="min-w-0 truncate">
            {c.kind === "christmas" ? t("countdown.christmas") : c.title}
          </span>
          <span className="shrink-0 font-semibold">· {days(c)}</span>
        </li>
      ))}
    </ul>
  );
}

/** On an Entry: a switch to count the days to it on the Wall. */
export function CountdownSwitch({ entryId }: { entryId: string }) {
  const { t } = useTranslation();
  const marked = useCountdowns().data?.marked.includes(entryId) ?? false;
  const mark = useMarkCountdown();
  return (
    <button
      type="button"
      aria-pressed={marked}
      data-testid="countdown-switch"
      onClick={() => mark.mutate({ entryId, on: !marked })}
      className={`flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-sm ${
        marked ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
      }`}
    >
      <Hourglass aria-hidden size={16} />
      {t("countdown.mark")}
    </button>
  );
}
