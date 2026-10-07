import type { SelectHTMLAttributes } from "react";

const STEP = 5;

const TIMES = Array.from({ length: (24 * 60) / STEP }, (_, i) => {
  const minutes = i * STEP;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/**
 * A time of day in 5-minute steps. A value off the grid (older data) is kept as an extra option
 * so it still shows. `optional` adds an empty choice.
 */
export function TimeSelect({
  value,
  optional = false,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & {
  value: string;
  optional?: boolean;
}) {
  const offGrid = value !== "" && !TIMES.includes(value);
  return (
    <select
      {...props}
      value={value}
      className="rounded-md border border-line bg-surface px-3 py-2 text-base text-ink disabled:opacity-60"
    >
      {(optional || value === "") && <option value="" />}
      {offGrid && <option value={value}>{value}</option>}
      {TIMES.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
