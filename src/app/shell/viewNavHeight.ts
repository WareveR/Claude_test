import { useLayoutEffect } from "react";

/**
 * Keeps `--view-nav-h` on the page at the options bar's height, so a view's days row can stick
 * just under it; the bar wraps to more lines on a narrow screen, so its height is measured.
 */
export function useViewNavHeight() {
  useLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>("nav[data-view-nav]");
    if (!nav || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const measure = () =>
      root.style.setProperty("--view-nav-h", `${nav.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    // Gone with the view, so a screen without the bar (the Wall) keeps its days row in place.
    return () => {
      observer.disconnect();
      root.style.removeProperty("--view-nav-h");
    };
  }, []);
}
