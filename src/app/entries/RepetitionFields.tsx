import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { addDays, formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import type { Repetition } from "../../core/repetition";
import { useSignedIn } from "../family";
import { Field, TextInput } from "../screens/form";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";
const MONDAY = "2026-10-05";

/** Repetition: every N days, weeks (on chosen weekdays), months or years, and how it ends. */
export function RepetitionFields({
  value,
  start,
  onChange,
}: {
  value: Repetition | null;
  start: PlainDate;
  onChange: (repetition: Repetition | null) => void;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const set = (patch: Partial<Repetition>) => onChange({ ...value!, ...patch } as Repetition);

  return (
    <fieldset className="flex flex-col gap-3 text-sm">
      <legend className="mb-1 font-medium">{t("entryTypes.repetition")}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("repetition.frequency")}>
          <select
            className={INPUT}
            value={value?.frequency ?? "none"}
            onChange={(e) =>
              onChange(
                e.target.value === "none"
                  ? null
                  : {
                      frequency: e.target.value as Repetition["frequency"],
                      interval: value?.interval ?? 1,
                      end: value?.end ?? { type: "never" },
                      ...(e.target.value === "weekly" ? { weekdays: [weekday(start)] } : {}),
                    },
              )
            }
          >
            {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((f) => (
              <option key={f} value={f}>
                {t(`repetition.${f}`)}
              </option>
            ))}
          </select>
        </Field>
        {value && (
          <Field label={t("repetition.interval")}>
            <TextInput
              type="number"
              min={1}
              className="w-20"
              value={value.interval}
              onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
        )}
      </div>
      {value?.frequency === "weekly" && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, d) => {
            const days = value.weekdays ?? [weekday(start)];
            return (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={days.includes(d)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...days, d] : days.filter((x) => x !== d);
                    if (next.length > 0) set({ weekdays: next.sort() });
                  }}
                />
                <span className="first-letter:uppercase">
                  {formatPlainDate(addDays(MONDAY, d), locale, { weekday: "short" })}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {value && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("repetition.ends")}>
            <select
              className={INPUT}
              value={value.end.type}
              onChange={(e) =>
                set({
                  end:
                    e.target.value === "until"
                      ? { type: "until", date: addDays(start, 90) }
                      : e.target.value === "count"
                        ? { type: "count", count: 10 }
                        : { type: "never" },
                })
              }
            >
              <option value="never">{t("repetition.never")}</option>
              <option value="until">{t("repetition.until")}</option>
              <option value="count">{t("repetition.count")}</option>
            </select>
          </Field>
          {value.end.type === "until" && (
            <Field label={t("repetition.untilDate")}>
              <TextInput
                type="date"
                min={start}
                value={value.end.date}
                onChange={(e) => set({ end: { type: "until", date: e.target.value } })}
              />
            </Field>
          )}
          {value.end.type === "count" && (
            <Field label={t("repetition.times")}>
              <TextInput
                type="number"
                min={1}
                className="w-20"
                value={value.end.count}
                onChange={(e) =>
                  set({ end: { type: "count", count: Math.max(1, Number(e.target.value) || 1) } })
                }
              />
            </Field>
          )}
        </div>
      )}
    </fieldset>
  );
}
