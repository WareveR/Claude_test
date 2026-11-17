import { Ban } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { TASK_COLORS, type TaskColor } from "../../core/task-color";

/** The background of a coloured Task or item: its colour mixed into the theme's own background. */
export function tint(color: string | null | undefined): CSSProperties | undefined {
  return color ? { backgroundColor: `color-mix(in srgb, ${color} 45%, var(--bg))` } : undefined;
}

/** Picks a Task's, a list's or an item's background colour, or none. */
export function ColorChoice({
  value,
  onChange,
}: {
  value: TaskColor | null;
  onChange: (color: TaskColor | null) => void;
}) {
  const { t } = useTranslation();
  const ring = (on: boolean) => `size-9 rounded-full border-2 ${on ? "border-ink" : "border-line"}`;
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1 font-medium">{t("taskColor.label")}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("taskColor.label")}>
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label={t("taskColor.none")}
          onClick={() => onChange(null)}
          className={`${ring(value === null)} flex items-center justify-center bg-surface text-muted`}
        >
          <Ban aria-hidden size={16} />
        </button>
        {TASK_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={t("taskColor.n", { n: i + 1 })}
            onClick={() => onChange(c)}
            style={{ backgroundColor: c }}
            className={ring(c === value)}
          />
        ))}
      </div>
    </fieldset>
  );
}
