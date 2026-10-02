import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { usePersons } from "./model";
import { PersonAvatar } from "./PersonAvatar";

export function PersonsSection() {
  const { t } = useTranslation();
  const persons = usePersons();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("persons.title")}</h2>
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {persons.data?.map((person) => (
          <li key={person.id}>
            <Link
              to={`/settings/persons/${person.id}`}
              className={`flex items-center gap-3 px-3 py-2 ${person.archived ? "opacity-50" : ""}`}
            >
              <PersonAvatar person={person} />
              <span>{person.name}</span>
              {person.archived && <span className="text-xs">{t("persons.archived")}</span>}
            </Link>
          </li>
        ))}
        <li>
          <Link to="/settings/persons/new" className="flex items-center gap-3 px-3 py-2">
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("persons.add")}
          </Link>
        </li>
      </ul>
    </section>
  );
}
