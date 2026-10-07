import { useTranslation } from "react-i18next";
import { nextRoundStart, roundEnd } from "../../core/checklist";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { Checklist } from "./model";

const SHORT = { day: "numeric", month: "short" } as const;

/**
 * A Checklist's period in a few words: "1 Jul – 31 Jul", "Until 31 Jul", "From 1 Jul", or for a
 * repeating one its current round and when the next one starts. Null without any date.
 */
export function usePeriodText(checklist: Checklist): string | null {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const date = (d: string) => formatPlainDate(d, locale, SHORT);
  const { startDate } = checklist;
  const end = roundEnd(checklist);
  const range = (from: string, to: string) =>
    from === to ? date(from) : `${date(from)} – ${date(to)}`;
  if (checklist.repetition && startDate) {
    const next = nextRoundStart(checklist);
    const round = t("checklists.thisRound", { period: range(startDate, end ?? startDate) });
    return next ? `${round} · ${t("checklists.nextRound", { date: date(next) })}` : round;
  }
  if (startDate && end) return range(startDate, end);
  if (end) return t("checklists.until", { date: date(end) });
  if (startDate) return t("checklists.from", { date: date(startDate) });
  return null;
}
