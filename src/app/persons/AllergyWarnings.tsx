import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { allergyWarnings } from "../../core/person-profile";
import { usePersons } from "./model";

/** "Bia: amendoim (Manteiga de amendoim)": the Persons' allergies these ingredients mention. */
export function AllergyWarnings({ ingredients }: { ingredients: string[] }) {
  const { t } = useTranslation();
  const warnings = allergyWarnings(ingredients, usePersons().data ?? []);
  if (warnings.length === 0) return null;
  return (
    <div
      role="note"
      data-testid="allergy-warnings"
      className="flex gap-2 rounded-md border border-overdue bg-overdue/10 px-3 py-2 text-sm"
    >
      <ShieldAlert aria-hidden size={18} className="mt-0.5 shrink-0 text-overdue" />
      <div>
        <p className="font-medium">{t("persons.profile.warning")}</p>
        <ul>
          {warnings.map((w) => (
            <li key={`${w.person}-${w.allergy}`}>{t("persons.profile.warningLine", w)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
