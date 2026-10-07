import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/** How far a row must move sideways before it counts as a swipe, and before it goes. */
const START_PX = 10;
const AWAY_PX = 120;
const ANIMATION_MS = 200;

/**
 * A row that can be dragged or swiped sideways, with mouse or touch, past a threshold to send
 * it away; short of that it springs back. Vertical moves are left to the page's scrolling.
 * Presses on the row's own controls (tick box, buttons) are left alone.
 */
export function useSwipeAway(onAway: () => void) {
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "away">("idle");
  const start = useRef<{ x: number; y: number; id: number; swiping: boolean } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0 || !e.isPrimary || phase === "away") return;
    if ((e.target as Element).closest("input, button, select, textarea, a, form")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false };
  }
  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (!s.swiping) {
      if (Math.abs(moveY) > START_PX && Math.abs(moveY) > Math.abs(moveX)) {
        start.current = null;
        return;
      }
      if (Math.abs(moveX) < START_PX) return;
      s.swiping = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      window.getSelection()?.removeAllRanges();
      setPhase("dragging");
    }
    setDx(moveX);
  }
  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const s = start.current;
    start.current = null;
    if (!s?.swiping || e.pointerId !== s.id) return;
    const moveX = e.clientX - s.x;
    if (Math.abs(moveX) >= AWAY_PX) {
      setPhase("away");
      setDx(Math.sign(moveX) * e.currentTarget.getBoundingClientRect().width);
      window.setTimeout(onAway, ANIMATION_MS);
    } else {
      setPhase("idle");
      setDx(0);
    }
  }
  function onPointerCancel() {
    start.current = null;
    setPhase("idle");
    setDx(0);
  }

  const style: CSSProperties = {
    transform: dx ? `translateX(${dx}px)` : undefined,
    opacity: phase === "away" ? 0 : 1 - Math.min(Math.abs(dx) / (AWAY_PX * 3), 0.5),
    transition:
      phase === "dragging"
        ? "none"
        : `transform ${ANIMATION_MS}ms ease-out, opacity ${ANIMATION_MS}ms ease-out`,
    // Vertical swipes still scroll the page; sideways ones reach the row.
    touchAction: "pan-y",
  };
  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
  };
}
