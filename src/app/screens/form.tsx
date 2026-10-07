import { useOnline } from "../offline/online";
import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

/** A labelled control; the label points at the control so its name is just the label. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="rounded-md border border-line bg-surface px-3 py-2 text-base" />
  );
}

export function SubmitButton({ children, busy }: { children: ReactNode; busy: boolean }) {
  // Saving needs a connection.
  const online = useOnline();
  return (
    <button
      type="submit"
      disabled={busy || !online}
      className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Cancel and Save, pinned to the bottom of the screen so they never need scrolling to. */
export function FormActions({
  busy,
  saveLabel,
  cancelLabel,
  onCancel,
}: {
  busy: boolean;
  saveLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-[5] -mx-4 flex justify-end gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
      <button type="button" className="rounded-md border border-line px-4 py-2" onClick={onCancel}>
        {cancelLabel}
      </button>
      <SubmitButton busy={busy}>{saveLabel}</SubmitButton>
    </div>
  );
}

export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-overdue">
      {children}
    </p>
  );
}
