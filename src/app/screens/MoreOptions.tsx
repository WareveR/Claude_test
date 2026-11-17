import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * The less used fields of a form, folded away so that adding something new asks only for the
 * essentials. Closed at first, also when editing; its title says how many of them are set.
 */
export function MoreOptions({ set, children }: { set: number; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <details className="group rounded-lg border border-line" data-testid="more-options">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          size={16}
          className="-rotate-90 transition-transform group-open:rotate-0"
        />
        {t("moreOptions.label")}
        {set > 0 && (
          <span className="text-xs font-normal text-muted">
            {t("moreOptions.set", { count: set })}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-4 border-t border-line p-3">{children}</div>
    </details>
  );
}
