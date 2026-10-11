import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ComingUp } from "../briefing/ComingUp";
import { HourlyStrip } from "../weather/HourlyStrip";
import { SunBand } from "../weather/SunBand";

const COLLAPSED_KEY = "side-panel-collapsed";

/** Whether the panel is hidden, remembered per device and shared with the header's button. */
let collapsed: boolean | null = null;
/** How many panels the page shows; the header's button only appears while there is one. */
let mounted = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function readCollapsed(): boolean {
  if (collapsed === null) {
    try {
      collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      collapsed = false;
    }
  }
  return collapsed;
}

export function togglePanel() {
  collapsed = !readCollapsed();
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Not remembered; the panel still hides.
  }
  notify();
}

export function usePanelCollapsed(): boolean {
  return useSyncExternalStore(subscribe, readCollapsed, () => false);
}

/** Whether the page has a side panel for the header's button to show or hide. */
export function usePanelOnPage(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mounted > 0,
    () => false,
  );
}

/** Where the panel moves beside the view. */
const WIDE = {
  lg: {
    row: "lg:min-h-0 lg:flex-1 lg:flex-row",
    aside: "lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 2xl:w-[26rem]",
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
 * the view and the page scrolls as one. The header's panel button hides it, remembered per device.
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
  const hidden = usePanelCollapsed();
  const wide = WIDE[wideAt];
  useEffect(() => {
    mounted += 1;
    notify();
    return () => {
      mounted -= 1;
      notify();
    };
  }, []);
  return (
    <div className={`flex flex-col ${wide.row}`}>
      <aside
        id="side-panel"
        data-testid="side-panel"
        aria-label={t("sidePanel.label")}
        hidden={hidden}
        className={`flex flex-col gap-3 border-b border-line pt-2 pb-3 ${wide.aside}`}
      >
        {!hidden && panel}
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
  lg: "flex h-[calc(100dvh-11rem)] min-h-72 flex-col lg:h-auto lg:min-h-0 lg:flex-1",
} as const;
