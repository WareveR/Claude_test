import { useEffect, useRef } from "react";

/** How far and how straight a finger must move, and how quickly, to count as a swipe. */
const MIN_PX = 60;
const MAX_MS = 700;

/** Which sideways swipes a touch may make, by what it began on. */
type Allowed = { previous: boolean; next: boolean };

/**
 * Which ways the touch may swipe, by what it began on: none in a dialog; on a strip that scrolls
 * sideways (the forecast's next days), none, unless the strip sits under `data-swipe-past-edges`
 * (the year), when a swipe that begins with the strip already at an end goes past that end.
 */
function allowedFrom(target: EventTarget | null): Allowed {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.getAttribute("role") === "dialog") return { previous: false, next: false };
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) {
      if (!el.closest("[data-swipe-past-edges]")) return { previous: false, next: false };
      return {
        previous: el.scrollLeft <= 0,
        next: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      };
    }
  }
  return { previous: true, next: true };
}

/**
 * A quick sideways swipe anywhere on the page moves through dates, like the arrows: the finger
 * moving left brings the next period, moving right the previous one. Swipes on a strip that
 * scrolls sideways (the forecast's next days) or in a popup are left alone, and so is anything
 * mostly up or down. The year's grid, once scrolled to an end, lets a new swipe that way through.
 */
export function useSwipe(onPrevious: (() => void) | null, onNext: (() => void) | null) {
  const handlers = useRef({ onPrevious, onNext });
  useEffect(() => {
    handlers.current = { onPrevious, onNext };
  });
  const enabled = Boolean(onPrevious && onNext);
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; at: number; allowed: Allowed } | null = null;
    const down = (e: TouchEvent) => {
      const allowed = allowedFrom(e.target);
      start =
        e.touches.length === 1 && (allowed.previous || allowed.next)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY, at: e.timeStamp, allowed }
          : null;
    };
    const up = (e: TouchEvent) => {
      const from = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!from || !touch || e.timeStamp - from.at > MAX_MS) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
      if (dx < 0) {
        if (from.allowed.next) handlers.current.onNext?.();
      } else if (from.allowed.previous) handlers.current.onPrevious?.();
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchend", up);
    };
  }, [enabled]);
}
