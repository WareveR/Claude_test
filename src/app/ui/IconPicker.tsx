import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ICON_GROUPS, type Icon as IconKey, type IconGroup } from "../../core/entry-type";
import { Icon } from "./Icon";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";

/** Lower case without accents, so "depilacao" finds "Depilação". */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The icon choice for an Entry or Entry Type: a box that finds an icon by its name, and the icons a
 * group at a time (opening on the group of the icon already chosen). `before` sits ahead of the
 * icons, such as "the Type's icon".
 */
export function IconPicker({
  value,
  onChange,
  before,
}: {
  value: string | null;
  onChange: (icon: IconKey) => void;
  before?: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<IconGroup>(
    () =>
      ICON_GROUPS.find((g) => (g.icons as readonly string[]).includes(value ?? ""))?.id ??
      ICON_GROUPS[0].id,
  );
  const name = (key: IconKey) => t(`icons.names.${key}`);
  const words = plain(query.trim());
  const shown: readonly IconKey[] = words
    ? ICON_GROUPS.flatMap((g) => g.icons).filter((key) => plain(name(key)).includes(words))
    : (ICON_GROUPS.find((g) => g.id === group)?.icons ?? []);
  return (
    <div className="flex flex-col gap-2" data-testid="icon-picker">
      <label className="relative flex items-center">
        <Search aria-hidden size={16} className="pointer-events-none absolute left-3 text-muted" />
        <input
          type="search"
          aria-label={t("icons.search")}
          placeholder={t("icons.search")}
          className={`${INPUT} w-full pl-9`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Inside the Entry's form, Enter here must not save it.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
      </label>
      {!words && (
        <div className="flex flex-wrap gap-1" role="tablist">
          {ICON_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === group}
              onClick={() => setGroup(g.id)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${g.id === group ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
            >
              {t(`icons.groups.${g.id}`)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {before}
        {shown.map((key) => (
          <label key={key} className="cursor-pointer" title={name(key)}>
            <input
              type="radio"
              name="icon"
              checked={value === key}
              onChange={() => onChange(key)}
              className="peer sr-only"
              aria-label={name(key)}
            />
            <span className="flex size-10 items-center justify-center rounded-md peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
              <Icon name={key} size={20} />
            </span>
          </label>
        ))}
        {words && shown.length === 0 && <p className="text-sm text-muted">{t("icons.none")}</p>}
      </div>
    </div>
  );
}
