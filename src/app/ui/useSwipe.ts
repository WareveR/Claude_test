import { useEffect, useRef } from "react";

/** How far and how straight a finger must move, and how quickly, to count as a swipe. */
const MIN_PX = 60;
const MAX_MS = 700;

/** Whether the touch began on something that scrolls sideways itself, or in a dialog. */
function ownsTheGesture(target: EventTarget | null) {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.getAttribute("role") === "dialog") return true;
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) {
      return true;
    }
  }
  return false;
}

/**
 * A quick sideways swipe anywhere on the page moves through dates, like the arrows: the finger
 * moving left brings the next period, moving right the previous one. Swipes on a strip that
 * scrolls sideways (the forecast's next days) or in a popup are left alone, and so is anything
 * mostly up or down.
 */
export function useSwipe(onPrevious: (() => void) | null, onNext: (() => void) | null) {
  const handlers = useRef({ onPrevious, onNext });
  useEffect(() => {
    handlers.current = { onPrevious, onNext };
  });
  const enabled = Boolean(onPrevious && onNext);
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; at: number } | null = null;
    const down = (e: TouchEvent) => {
      start =
        e.touches.length === 1 && !ownsTheGesture(e.target)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY, at: e.timeStamp }
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
      if (dx < 0) handlers.current.onNext?.();
      else handlers.current.onPrevious?.();
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchend", up);
    };
  }, [enabled]);
}
