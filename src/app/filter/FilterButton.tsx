import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isFiltering } from "../../core/person-filter";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { setPersonFilter, usePersonFilter } from "./model";

/** The Person Filter panel: several Persons and the Family-wide switch. */
export function FilterButton() {
  const { t } = useTranslation();
  const filter = usePersonFilter();
  const persons = (usePersons().data ?? []).filter(
    (p) => !p.archived || filter.personIds.includes(p.id),
  );
  const picked = persons.filter((p) => filter.personIds.includes(p.id));
  const toggle = (id: string, on: boolean) =>
    setPersonFilter({
      ...filter,
      personIds: on ? [...filter.personIds, id] : filter.personIds.filter((p) => p !== id),
    });

  return (
    <details className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-sm ${isFiltering(filter) ? "bg-surface font-medium" : ""}`}
        aria-label={t("filter.title")}
      >
        <Filter aria-hidden size={18} strokeWidth={1.75} />
        <span className="flex -space-x-1">
          {picked.map((p) => (
            <PersonAvatar key={p.id} person={p} size={20} />
          ))}
        </span>
      </summary>
      <div
        className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-md border border-line bg-bg p-3 text-sm shadow-lg"
        role="group"
        aria-label={t("filter.title")}
      >
        <p className="font-medium">{t("filter.title")}</p>
        {persons.map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filter.personIds.includes(p.id)}
              onChange={(e) => toggle(p.id, e.target.checked)}
            />
            <PersonAvatar person={p} size={22} />
            {p.name}
          </label>
        ))}
        <p className="text-xs text-muted">{t("filter.noneHint")}</p>
        <label className="flex items-center gap-2 border-t border-line pt-2">
          <input
            type="checkbox"
            checked={filter.familyWide}
            onChange={(e) => setPersonFilter({ ...filter, familyWide: e.target.checked })}
          />
          {t("filter.familyWide")}
        </label>
      </div>
    </details>
  );
}
