import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { EntryTypeBadge } from "./EntryTypeBadge";
import { typeName, useEntryTypes } from "./model";

export function EntryTypesSection() {
  const { t } = useTranslation();
  const types = useEntryTypes();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("entryTypes.title")}</h2>
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {types.data?.map((type) => (
          <li key={type.id}>
            <Link
              to={`/settings/entry-types/${type.id}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              <EntryTypeBadge type={type} />
              <span>{typeName(type, t)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link to="/settings/entry-types/new" className="flex items-center gap-3 px-3 py-2">
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("entryTypes.add")}
          </Link>
        </li>
      </ul>
    </section>
  );
}
