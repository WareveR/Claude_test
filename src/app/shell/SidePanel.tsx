import type { ReactNode } from "react";
import { ComingUp } from "../briefing/ComingUp";
import { HourlyStrip } from "../weather/HourlyStrip";
import { SunBand } from "../weather/SunBand";

/** Today at a glance: its hourly weather, sunrise and sunset, and "Coming up". The Summary screen. */
export function TodayPanel({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      <HourlyStrip />
      <SunBand />
      <ComingUp readOnly={readOnly} />
    </>
  );
}

/** A calendar view's body under its bar: on wide screens it fills the free height. */
export function ViewBody({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">{children}</div>;
}

/**
 * The box a time grid fills: the free height on wide screens, and on narrow ones (a phone, a big
 * zoom) a fixed share of the screen, so the stacked page scrolls and the grid keeps its own room.
 */
export const GRID_BOX = {
  lg: "flex h-[calc(100dvh-11rem)] min-h-72 flex-col lg:h-auto lg:min-h-0 lg:flex-1",
} as const;
