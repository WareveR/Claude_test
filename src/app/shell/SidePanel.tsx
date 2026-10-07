import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ComingUp } from "../briefing/ComingUp";
import { BUTTON } from "../ui/button";
import { HourlyStrip } from "../weather/HourlyStrip";
import { SunBand } from "../weather/SunBand";

const COLLAPSED_KEY = "side-panel-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Not remembered; the panel still hides.
  }
}

/** Where the panel moves beside the view: the wall's board at md, the views at lg. */
const WIDE = {
  md: {
    row: "md:min-h-0 md:flex-1 md:flex-row",
    aside: "md:w-[28rem] md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0",
    rail: "md:border-r md:border-b-0 md:px-1 md:py-2",
    label: "md:sr-only",
    main: "md:min-h-0 md:flex-1",
  },
  lg: {
    row: "lg:min-h-0 lg:flex-1 lg:flex-row",
    aside: "lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 2xl:w-[26rem]",
    rail: "lg:border-r lg:border-b-0 lg:px-1 lg:py-2",
    label: "lg:sr-only",
    main: "lg:min-h-0 lg:flex-1",
  },
} as const;

/**
 * Today's side of every calendar view and the wall: its hourly weather, sunrise and sunset and
 * "Coming up", plus whatever else is given (the wall's list of today).
 */
export function TodayPanel({ readOnly, children }: { readOnly?: boolean; children?: ReactNode }) {
  return (
    <>
      <HourlyStrip />
      <SunBand />
      <ComingUp readOnly={readOnly} />
      {children}
    </>
  );
}

/**
 * The view beside a panel on its left, as on the wall; on narrow screens the panel sits above
 * the view and the page scrolls as one. The panel hides with a button, remembered per device.
 */
export function SidePanelLayout({
  panel,
  children,
  wideAt = "lg",
}: {
  panel: ReactNode;
  children: ReactNode;
  wideAt?: keyof typeof WIDE;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const wide = WIDE[wideAt];
  const toggle = () => {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };
  return (
    <div className={`flex flex-col ${wide.row}`}>
      {collapsed && (
        <div className={`flex items-start border-b border-line px-4 py-1 ${wide.rail}`}>
          <button
            type="button"
            aria-expanded="false"
            aria-controls="side-panel"
            title={t("sidePanel.show")}
            className={BUTTON}
            onClick={toggle}
          >
            <PanelLeftOpen aria-hidden size={18} />
            <span className={wide.label}>{t("sidePanel.show")}</span>
          </button>
        </div>
      )}
      <aside
        id="side-panel"
        data-testid="side-panel"
        aria-label={t("sidePanel.label")}
        hidden={collapsed}
        className={`flex flex-col gap-3 border-b border-line pb-3 ${wide.aside}`}
      >
        <div className="flex justify-end px-4 pt-2">
          <button
            type="button"
            aria-expanded="true"
            aria-controls="side-panel"
            className={BUTTON}
            onClick={toggle}
          >
            <PanelLeftClose aria-hidden size={16} />
            {t("sidePanel.hide")}
          </button>
        </div>
        {!collapsed && panel}
      </aside>
      <div className={`flex min-w-0 flex-col ${wide.main}`}>{children}</div>
    </div>
  );
}

/**
 * The box a time grid fills: the free height on wide screens, and on narrow ones (a phone, a big
 * zoom) a fixed share of the screen, so the stacked page scrolls and the grid keeps its own room.
 */
export const GRID_BOX = {
  md: "flex h-[calc(100dvh-9rem)] min-h-72 flex-col md:h-auto md:min-h-0 md:flex-1",
  lg: "flex h-[calc(100dvh-11rem)] min-h-72 flex-col lg:h-auto lg:min-h-0 lg:flex-1",
} as const;
