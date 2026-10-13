import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { isShoppingEntry } from "../../core/preparation";
import { forStore, groupShopping, openStores, storeNamedIn } from "../../core/shopping";
import { paths } from "../paths";
import { BUTTON } from "../ui/button";
import { setStoreFilter, useShoppingItems } from "./model";

/** How many items a shopping trip's Entry shows before "+N". */
const SHOWN = 10;

/**
 * A shopping trip's Entry ("Supermercado", "Compras no Lidl"): what is still to buy on the
 * Family's Shopping List, by section, only to read, with a link to the list. When the title
 * names a shop the items are tagged with, only that shop's items and those for any shop, and
 * the link opens the list narrowed to it. Nothing for any other Entry.
 */
export function EntryShopping({
  title,
  type,
  className = "border-t border-line pt-3",
}: {
  title: string;
  type: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const items = useShoppingItems();
  if (!isShoppingEntry(title, type) || !items.data) return null;
  const open = items.data.filter((item) => !item.boughtAt);
  const store = storeNamedIn(title, openStores(open));
  const { sections } = groupShopping(forStore(open, store));
  const shown: typeof sections = [];
  let left = SHOWN;
  for (const { section, items: inSection } of sections) {
    if (left <= 0) break;
    shown.push({ section, items: inSection.slice(0, left) });
    left -= inSection.length;
  }
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  return (
    <section className={`flex flex-col gap-2 ${className}`} data-testid="entry-shopping">
      <h3 className="flex items-center gap-2 font-semibold">
        <ShoppingCart aria-hidden size={18} className="shrink-0 text-muted" />
        {store ? `${t("shopping.title")} · ${store}` : t("shopping.title")}
      </h3>
      {total === 0 && <p className="text-sm text-muted">{t("shopping.entryEmpty")}</p>}
      {shown.map(({ section, items: inSection }) => (
        <div key={section} className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t(`shopping.sections.${section}`)}
          </h4>
          <ul className="flex flex-col gap-1">
            {inSection.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 break-words">{item.name}</span>
                {item.quantity && <span className="text-sm text-muted">{item.quantity}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {total > SHOWN && (
        <p className="text-sm text-muted">{t("shopping.entryMore", { count: total - SHOWN })}</p>
      )}
      <Link
        to={paths.shopping()}
        onClick={() => setStoreFilter(store)}
        className={`${BUTTON} self-start`}
      >
        {t("shopping.entryOpen")}
      </Link>
    </section>
  );
}
