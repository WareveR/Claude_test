import { useEffect, useRef, useState } from "react";
import { inOvernightWindow, msUntilMidnight } from "../../core/display";
import { todayIn, type PlainDate } from "../../core/plain-date";
import { applyUpdate, useUpdateWaiting } from "../offline/service-worker";

/** Today in the Family Time Zone, recomputed when the date rolls over at midnight. */
export function useRolloverToday(timeZone: string): PlainDate {
  const [today, setToday] = useState(() => todayIn(timeZone));
  useEffect(() => {
    const refresh = () => setToday(todayIn(timeZone));
    refresh();
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(
        () => {
          refresh();
          arm();
        },
        msUntilMidnight(timeZone) + 500,
      );
    };
    arm();
    // A sleeping tablet's timers may have been late; look again on waking.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        clearTimeout(timer);
        arm();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timeZone]);
  return today;
}

/** Keeps the screen awake while on; asks again whenever the page comes back to the front. */
export function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
        if (sentinel && !sentinel.released) return;
        const lock = await navigator.wakeLock.request("screen");
        if (stopped) void lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // Refused (low battery, unsupported): the screen may sleep, nothing else breaks.
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

/** Applies a waiting new version of the app, but only overnight (02:00 to 05:00). */
export function useOvernightReload(timeZone: string) {
  const waiting = useUpdateWaiting();
  useEffect(() => {
    if (!waiting) return;
    const check = () => {
      if (inOvernightWindow(timeZone)) applyUpdate();
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [waiting, timeZone]);
}

/** Calls back once the pointer has stayed down for `ms` without moving away. */
export function useLongPress(callback: () => void, ms = 1500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown: () => {
      cancel();
      timer.current = setTimeout(callback, ms);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}
