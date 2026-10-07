import { useTranslation } from "react-i18next";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const SELECT =
  "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink tabular-nums disabled:opacity-60";

/**
 * A time of day as an hour and a minute picked apart, the minutes in 5-minute steps. A minute off
 * the grid (older data) is kept as an extra choice so it still shows. `optional` adds empty
 * choices; the field's own label names the hour, `label` names the minutes too.
 */
export function TimeSelect({
  id,
  label,
  value,
  onChange,
  optional = false,
  disabled,
  required,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const [hour = "", minute = ""] = value ? value.split(":") : [];
  const minutes = minute && !MINUTES.includes(minute) ? [minute, ...MINUTES].sort() : MINUTES;
  return (
    <div className="flex items-center gap-1">
      <select
        id={id}
        className={SELECT}
        value={hour}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${minute || "00"}` : "")}
      >
        {(optional || !hour) && <option value="" />}
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select
        aria-label={t("time.minutesOf", { label })}
        className={SELECT}
        value={minute}
        disabled={disabled || !hour}
        required={required}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
      >
        {!minute && <option value="" />}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
