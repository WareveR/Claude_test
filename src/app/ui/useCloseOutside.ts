import { useEffect, useRef } from "react";

/** A native <details> menu that closes on a tap outside it, or on Escape. */
export function useCloseOutside() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return ref;
}
