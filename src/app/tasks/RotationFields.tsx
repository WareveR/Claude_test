import { useTranslation } from "react-i18next";
import type { Rotation } from "../../core/rotation";
import type { PlainDate } from "../../core/plain-date";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";

/**
 * A repeating Task's Rotation: who takes turns, in the order picked (the first starts), and
 * whether the turn passes on each time or each week.
 */
export function RotationFields({
  value,
  start,
  onChange,
}: {
  value: Rotation | null;
  start: PlainDate;
  onChange: (rotation: Rotation | null) => void;
}) {
  const { t } = useTranslation();
  const persons = (usePersons().data ?? []).filter(
    (p) => (!p.archived && p.kind !== "animal") || value?.personIds.includes(p.id),
  );
  const ids = value?.personIds ?? [];
  const every = value?.every ?? "turn";
  // Kept as picked; with fewer than two there is no one to take turns with yet.
  const change = (personIds: string[], nextEvery = every) =>
    onChange(
      personIds.length === 0 ? null : { personIds, every: nextEvery, turn: 0, anchor: start },
    );
  return (
    <fieldset className="flex flex-col gap-2 text-sm" data-testid="rotation">
      <legend className="mb-1 font-medium">{t("rotation.title")}</legend>
      <div className="flex flex-wrap gap-2">
        {persons.map((p) => {
          const at = ids.indexOf(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={at >= 0}
              onClick={() => change(at >= 0 ? ids.filter((id) => id !== p.id) : [...ids, p.id])}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 ${
                at >= 0 ? "border-accent bg-accent/15" : "border-line"
              }`}
            >
              <PersonAvatar person={p} size={24} />
              {p.name}
              {at >= 0 && <span className="text-xs font-semibold">{at + 1}</span>}
            </button>
          );
        })}
      </div>
      {ids.length > 0 && (
        <div role="radiogroup" aria-label={t("rotation.every")} className="flex gap-2">
          {(["turn", "week"] as const).map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={every === e}
              onClick={() => change(ids, e)}
              className={`min-h-9 rounded-full border px-3 py-1 ${
                every === e ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {t(`rotation.everyOptions.${e}`)}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        {ids.length === 1 ? t("rotation.needsTwo") : t("rotation.hint")}
      </p>
    </fieldset>
  );
}
