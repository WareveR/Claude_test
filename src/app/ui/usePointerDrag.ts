import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/** How far a mouse moves before a press becomes a drag, and how long a finger must rest. */
const MOVE_PX = 6;
const LONG_PRESS_MS = 450;
/** Near the top or bottom edge, the page (or the scroller) scrolls so far-away places can be reached. */
const EDGE_PX = 60;
const SCROLL_STEP = 12;

export type PointerDragOptions<P, D> = {
  /** What a press on this element starts dragging, or null when it isn't draggable. */
  pick: (target: Element, x: number, y: number) => P | null;
  /** The place under the pointer, or null where nothing can be dropped. */
  locate: (x: number, y: number, payload: P) => D | null;
  onDrop: (payload: P, place: D) => void;
  /** An element with its own scrolling, such as a time grid, that also scrolls near its edges. */
  scroller?: RefObject<HTMLElement | null>;
};

/**
 * Dragging something onto a place, with mouse or touch (pointer events, not the HTML5 drag
 * API). A mouse starts dragging after a small move, so clicks still open links; a finger first
 * rests for a long press, so swiping still scrolls the page.
 */
export function usePointerDrag<P, D>(options: PointerDragOptions<P, D>) {
  const [dragging, setDragging] = useState<P | null>(null);
  const [over, setOver] = useState<D | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  // Where the drag began; the ghost then follows the pointer without re-rendering.
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const opts = useRef(options);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    opts.current = options;
  });
  useEffect(() => () => stop.current?.(), []);

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || stop.current) return;
    const payload = opts.current.pick(e.target as Element, e.clientX, e.clientY);
    if (payload === null) return;
    const pointerId = e.pointerId;
    const start = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType === "touch";
    let active = false;
    let target: D | null = null;
    let last = start;
    let scrolling = 0;

    const place = (x: number, y: number) => {
      if (ghost.current) ghost.current.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
      const found = opts.current.locate(x, y, payload);
      if (JSON.stringify(found) !== JSON.stringify(target)) {
        target = found;
        setOver(found);
      }
    };
    const edgeScroll = () => {
      const box = opts.current.scroller?.current?.getBoundingClientRect();
      const inBox = box && last.x >= box.left && last.x <= box.right;
      const boxDy = !inBox
        ? 0
        : last.y < box.top + EDGE_PX
          ? -SCROLL_STEP
          : last.y > box.bottom - EDGE_PX
            ? SCROLL_STEP
            : 0;
      const dy =
        last.y < EDGE_PX ? -SCROLL_STEP : last.y > window.innerHeight - EDGE_PX ? SCROLL_STEP : 0;
      if (boxDy) opts.current.scroller!.current!.scrollBy(0, boxDy);
      if (dy) window.scrollBy(0, dy);
      if (boxDy || dy) place(last.x, last.y);
      scrolling = window.requestAnimationFrame(edgeScroll);
    };
    const begin = (x: number, y: number) => {
      active = true;
      scrolling = window.requestAnimationFrame(edgeScroll);
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
      if (touch) navigator.vibrate?.(15);
      setOrigin({ x, y });
      setDragging(payload);
      place(x, y);
    };
    const timer = touch ? window.setTimeout(() => begin(start.x, start.y), LONG_PRESS_MS) : 0;

    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < MOVE_PX) return;
        // A finger moving before the long press is scrolling the page.
        if (touch) return end();
        begin(ev.clientX, ev.clientY);
      }
      last = { x: ev.clientX, y: ev.clientY };
      place(ev.clientX, ev.clientY);
    };
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) {
        swallowNextClick();
        if (target !== null) opts.current.onDrop(payload, target);
      }
      end();
    };
    const cancel = (ev: globalThis.PointerEvent) => ev.pointerId === pointerId && end();
    // Once dragging, the finger moves the thing instead of scrolling the page.
    const touchMove = (ev: TouchEvent) => active && ev.cancelable && ev.preventDefault();
    // A long press would otherwise open the link's menu.
    const contextMenu = (ev: Event) => touch && ev.preventDefault();
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && end();

    function end() {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(scrolling);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", touchMove);
      document.removeEventListener("contextmenu", contextMenu);
      document.removeEventListener("keydown", key);
      if (active) {
        document.body.style.userSelect = "";
        setDragging(null);
        setOver(null);
      }
      stop.current = null;
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("contextmenu", contextMenu);
    document.addEventListener("keydown", key);
    stop.current = end;
  }

  /** The browser's own link dragging would take over the pointer of a press that picked something. */
  function onDragStart(e: DragEvent) {
    if (stop.current) e.preventDefault();
  }

  return {
    /** What is being dragged, and the place it is over. */
    dragging,
    over,
    /** Spread on the element holding both the draggable things and the places. */
    zone: { onPointerDown, onDragStart },
    /** For the floating copy that follows the pointer. */
    ghost,
    ghostStyle: {
      transform: `translate(${origin.x + 12}px, ${origin.y + 12}px)`,
    },
  };
}

/** The click that ends a drag must not open what was dragged. */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}
