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
    <input
      {...props}
      className="rounded-md border border-stone-300 bg-white px-3 py-2 text-base dark:border-stone-600 dark:bg-stone-900"
    />
  );
}

export function SubmitButton({ children, busy }: { children: ReactNode; busy: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {children}
    </button>
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
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {children}
    </p>
  );
}
