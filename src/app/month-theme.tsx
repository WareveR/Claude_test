import { useEffect, useId } from "react";
import { useLocation } from "react-router";
import { monthMotif, monthOfPath, monthPalette } from "../core/month-theme";
import { todayIn } from "../core/plain-date";
import { useSignedIn } from "./family";
import { useTheme } from "./theme";

const VARS = ["--bg", "--line", "--accent", "--header", "--weekend", "--weekend-ink"];

/**
 * With the Month theme on, the month being looked at: the day, week or month a view shows, else
 * today's. Null when another theme is on.
 */
export function useMonthOnScreen(): number | null {
  const theme = useTheme();
  const { pathname } = useLocation();
  const { timeZone } = useSignedIn().family;
  return theme === "month" ? monthOfPath(pathname, todayIn(timeZone)) : null;
}

/** The month on screen, with its colours put on <html>. Called once, by the app's layout. */
export function useMonthTheme(): number | null {
  const month = useMonthOnScreen();

  useEffect(() => {
    const root = document.documentElement;
    if (month === null) return;
    const p = monthPalette(month);
    const values = [p.bg, p.line, p.accent, p.header, p.weekend, p.weekendInk];
    VARS.forEach((name, i) => root.style.setProperty(name, values[i]!));
    root.dataset.month = String(month);
    return () => {
      for (const name of VARS) root.style.removeProperty(name);
      delete root.dataset.month;
    };
  }, [month]);
  return month;
}

/**
 * The month's drawing scattered faintly over the box it sits in, behind that box's content. Drawn
 * inline: the site's content policy keeps out images written into the CSS.
 */
export function MonthMotif({
  month,
  className,
  opacity,
}: {
  month: number;
  className: string;
  opacity: number;
}) {
  const id = useId();
  const motif = monthMotif(month);
  return (
    <svg
      aria-hidden
      data-testid="month-motif"
      className={`pointer-events-none -z-10 ${className}`}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern id={id} width="96" height="96" patternUnits="userSpaceOnUse">
          <g fill="currentColor" stroke="currentColor" strokeWidth="0" opacity={opacity}>
            <g transform="translate(10 10)" dangerouslySetInnerHTML={{ __html: motif }} />
            <g
              transform="translate(60 54) rotate(-18 9 9) scale(0.75)"
              dangerouslySetInnerHTML={{ __html: motif }}
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
