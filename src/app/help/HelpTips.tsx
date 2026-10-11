import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { helpTip, type HelpTip } from "../../core/help";
import { getHelpLevel } from "./level";

/** How long a pointer rests on a button, or a finger presses it, before its tip shows. */
const DELAY_MS = 500;
/** A finger that moves further than this is scrolling, not pressing. */
const SLOP_PX = 10;

/** The marked element under an event, if any. */
function marked(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-help]") : null;
}

/**
 * The tips for every element marked with data-help="<key>": its name (help.items.<key>.name,
 * else its aria-label or text) and,
 * by the device's help level, what it does (help.items.<key>.what) and what follows from it
 * (help.items.<key>.more). A mouse shows them after resting on the element; a finger after a
 * long press, which then doesn't also press the button.
 */
export function HelpTips() {
  const { t, i18n } = useTranslation();
  const [shown, setShown] = useState<{ el: HTMLElement; tip: HelpTip } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pressStart: { x: number; y: number } | null = null;
    let pressShown = false;

    const text = (key: string) => (i18n.exists(key) ? t(key) : null);
    const show = (el: HTMLElement) => {
      const key = el.dataset.help ?? "";
      const tip = helpTip(getHelpLevel(), {
        name:
          (key && text(`help.items.${key}.name`)) ??
          el.getAttribute("aria-label") ??
          el.textContent ??
          "",
        showsName: el.innerText.trim() !== "",
        what: key ? text(`help.items.${key}.what`) : null,
        more: key ? text(`help.items.${key}.more`) : null,
      });
      if (tip && el.isConnected) setShown({ el, tip });
      return tip !== null;
    };
    const hide = () => {
      clearTimeout(timer);
      setShown(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = marked(e.target);
      if (!el || el.contains(marked(e.relatedTarget))) return;
      hide();
      timer = setTimeout(() => show(el), DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = marked(e.target);
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") hide();
    };
    const onTouchStart = (e: TouchEvent) => {
      hide();
      pressShown = false;
      const el = marked(e.target);
      const touch = e.touches[0];
      if (!el || !touch || e.touches.length > 1) return;
      pressStart = { x: touch.clientX, y: touch.clientY };
      timer = setTimeout(() => {
        pressShown = show(el);
      }, DELAY_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!pressStart || !touch) return;
      if (Math.hypot(touch.clientX - pressStart.x, touch.clientY - pressStart.y) > SLOP_PX) {
        pressStart = null;
        clearTimeout(timer);
      }
    };
    const onTouchEnd = () => {
      pressStart = null;
      clearTimeout(timer);
    };
    // After a long press shows the tip, the press doesn't also open, follow or toggle anything.
    const onClick = (e: MouseEvent) => {
      if (!pressShown) return;
      pressShown = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onContextMenu = (e: Event) => {
      if (pressShown || marked(e.target)) e.preventDefault();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", hide);
    document.addEventListener("scroll", hide, { capture: true, passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", hide);
      document.removeEventListener("scroll", hide, { capture: true });
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, [t, i18n]);

  // Below the element, or above it when there's no room; never past the screen's sides.
  useLayoutEffect(() => {
    const tip = box.current;
    if (!shown || !tip) return;
    const gap = 6;
    const margin = 8;
    const at = shown.el.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const below = at.bottom + gap + height <= window.innerHeight - margin;
    const top = below ? at.bottom + gap : Math.max(margin, at.top - gap - height);
    const left = Math.min(
      Math.max(margin, at.left + at.width / 2 - width / 2),
      window.innerWidth - width - margin,
    );
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    tip.style.visibility = "visible";
  }, [shown]);

  if (!shown) return null;
  const { tip } = shown;
  return (
    <div
      ref={box}
      role="tooltip"
      data-testid="help-tip"
      style={{ visibility: "hidden" }}
      className="pointer-events-none fixed top-0 left-0 z-[60] flex max-w-72 flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-lg"
    >
      <span className="font-semibold">{tip.name}</span>
      {tip.what && <span>{tip.what}</span>}
      {tip.more && <span className="text-muted">{tip.more}</span>}
    </div>
  );
}
