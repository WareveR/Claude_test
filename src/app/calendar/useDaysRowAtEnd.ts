import { useEffect } from "react";
import { useLocation } from "react-router";

const HIDDEN = "data-days-row-hidden";
/** How far a finger moves before the gesture counts. */
const SWIPE_PX = 24;

/** Whether everything that scrolls between `from` and the page has reached its end. */
function atEnd(from: EventTarget | null) {
  let el = from instanceof Element ? from : null;
  for (; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 1) return false;
  }
  return true;
}

/** Popups and the bar's menus scroll on their own; their gestures are theirs. */
const outside = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[role="dialog"], details[open]') !== null;

/**
 * The days' row stays under the bar while the view scrolls. Once the view has reached its end, one
 * more swipe or turn of the wheel down hides it upwards; the first one back up shows it again, and
 * only the next ones scroll the view back.
 */
export function useDaysRowAtEnd() {
  // Moving on to another day, week, month or year brings it back.
  const { pathname } = useLocation();
  useEffect(() => document.documentElement.removeAttribute(HIDDEN), [pathname]);
  useEffect(() => {
    const root = document.documentElement;
    const hidden = () => root.hasAttribute(HIDDEN);
    const hide = () => root.setAttribute(HIDDEN, "");
    const show = () => root.removeAttribute(HIDDEN);

    const onWheel = (e: WheelEvent) => {
      if (outside(e.target) || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (e.deltaY > 0 && !hidden() && atEnd(e.target)) hide();
      else if (e.deltaY < 0 && hidden()) {
        show();
        e.preventDefault();
      }
    };

    // A touch that shows the row is spent on it: the view does not move until the next one.
    let startY: number | null = null;
    let spent = false;
    const onTouchStart = (e: TouchEvent) => {
      startY = outside(e.target) || e.touches.length !== 1 ? null : e.touches[0].clientY;
      spent = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (spent) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (startY === null) return;
      const moved = startY - e.touches[0].clientY;
      if (moved > SWIPE_PX && !hidden() && atEnd(e.target)) {
        hide();
        startY = null;
      } else if (moved < -SWIPE_PX / 3 && hidden()) {
        show();
        spent = true;
        if (e.cancelable) e.preventDefault();
      }
    };
    const onTouchEnd = () => {
      startY = null;
      spent = false;
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      // Another view opens with its row in place.
      show();
    };
  }, []);
}
