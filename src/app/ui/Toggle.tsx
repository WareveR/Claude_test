import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

/** A native checkbox's props, less what each control sets itself. */
type BoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/**
 * The real checkbox, invisible and stretched over its control so a tap anywhere on it lands on
 * the input itself; it keeps the checkbox's keyboard, form and screen-reader behaviour.
 */
const HIDDEN_INPUT =
  "absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed";

/** The ring a control shows when its input has keyboard focus. */
const FOCUS =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent";

/**
 * An on/off switch for a yes/no setting. Put it inside the `<label>` that names it.
 * It is a native checkbox with the `switch` role.
 */
export function Switch(props: BoxProps) {
  return (
    <span
      className={`group/switch relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-muted/45 transition-colors has-checked:bg-accent has-disabled:opacity-50 ${FOCUS}`}
    >
      <input {...props} type="checkbox" role="switch" className={HIDDEN_INPUT} />
      <span
        aria-hidden
        className="ml-0.5 size-5 rounded-full bg-white shadow-sm transition-transform group-has-checked/switch:translate-x-4 group-has-checked/switch:bg-accent-ink"
      />
    </span>
  );
}

/**
 * The round tick for marking something done: an empty circle while pending, a filled circle
 * with a check once done. Its touch area is larger than the circle. Name it with `aria-label`
 * or a wrapping `<label>`.
 */
export function Tick({ className = "", ...props }: BoxProps & { className?: string }) {
  return (
    <span
      className={`group/tick relative inline-flex size-10 shrink-0 items-center justify-center rounded-full has-disabled:opacity-50 ${FOCUS} ${className}`}
    >
      <input {...props} type="checkbox" className={HIDDEN_INPUT} />
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-full border-2 border-muted text-transparent transition-colors group-hover/tick:border-accent group-has-checked/tick:border-accent group-has-checked/tick:bg-accent group-has-checked/tick:text-accent-ink"
      >
        <Check size={15} strokeWidth={3} />
      </span>
    </span>
  );
}

/**
 * One choice of several that can be picked together (weekdays, Persons, reminder times):
 * a pill that fills with the accent colour when picked. It is its own `<label>`.
 */
export function Chip({ children, ...props }: BoxProps & { children: ReactNode }) {
  return (
    <label
      className={`group/chip relative inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm transition-colors hover:border-accent has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink has-disabled:opacity-50 ${FOCUS}`}
    >
      <input {...props} type="checkbox" className={HIDDEN_INPUT} />
      <Check
        aria-hidden
        size={14}
        strokeWidth={3}
        className="hidden group-has-checked/chip:block"
      />
      {children}
    </label>
  );
}
