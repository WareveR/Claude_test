import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from "react";

/** How far a mouse moves before a press becomes a drag, and how long a finger must rest. */
const MOVE_PX = 6;
const LONG_PRESS_MS = 450;

const TASK_LINK = '[data-testid="task"] a[href^="/tasks/"]';
const DROP = "[data-drop-checklist]";

/**
 * Dragging a loose Task's row onto a Checklist row, with mouse or touch (pointer events, not
 * the HTML5 drag API). A mouse starts dragging after a small move, so clicks still open the
 * Task; a finger first rests for a long press, so swiping still scrolls the page. Drop targets
 * carry `data-drop-checklist` with the Checklist's id.
 */
export function useDragToChecklist(onDrop: (taskId: string, checklistId: string) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  // Where the drag began; the ghost then follows the pointer without re-rendering.
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const dropRef = useRef(onDrop);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    dropRef.current = onDrop;
  });
  useEffect(() => () => stop.current?.(), []);

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || stop.current) return;
    const link = (e.target as Element).closest(TASK_LINK);
    if (!link) return;
    const taskId = link.getAttribute("href")!.slice("/tasks/".length);
    const pointerId = e.pointerId;
    const start = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType === "touch";
    let active = false;
    let target: string | null = null;

    const place = (x: number, y: number) => {
      if (ghost.current) ghost.current.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
      const found = document.elementFromPoint(x, y)?.closest<HTMLElement>(DROP);
      const id = found?.dataset.dropChecklist ?? null;
      if (id !== target) {
        target = id;
        setOver(id);
      }
    };
    const begin = (x: number, y: number) => {
      active = true;
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
      if (touch) navigator.vibrate?.(15);
      setOrigin({ x, y });
      setDragging(taskId);
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
      place(ev.clientX, ev.clientY);
    };
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) {
        swallowNextClick();
        if (target) dropRef.current(taskId, target);
      }
      end();
    };
    const cancel = (ev: globalThis.PointerEvent) => ev.pointerId === pointerId && end();
    // Once dragging, the finger moves the Task instead of scrolling the page.
    const touchMove = (ev: TouchEvent) => active && ev.cancelable && ev.preventDefault();
    // A long press would otherwise open the link's menu.
    const contextMenu = (ev: Event) => touch && ev.preventDefault();
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && end();

    function end() {
      window.clearTimeout(timer);
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

  /** The browser's own link dragging would take over the pointer. */
  function onDragStart(e: DragEvent) {
    if ((e.target as Element).closest?.(TASK_LINK)) e.preventDefault();
  }

  return {
    /** The Task being dragged, and the Checklist it is over. */
    dragging,
    over,
    /** Spread on the element holding both the Task rows and the Checklist rows. */
    zone: { onPointerDown, onDragStart },
    /** For the floating copy of the row that follows the pointer. */
    ghost,
    ghostStyle: {
      transform: `translate(${origin.x + 12}px, ${origin.y + 12}px)`,
    },
  };
}

/** The click that ends a drag must not open the Task. */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}
