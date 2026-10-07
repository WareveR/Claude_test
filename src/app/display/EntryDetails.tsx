import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { EntrySummary } from "../entries/EntrySummary";
import { paths } from "../paths";
import { BUTTON } from "../ui/button";

/** An Entry on the wall: read-only, and a Private one shows only "Private" and its time. */
export function EntryDetails() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [search] = useSearchParams();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6" data-testid="entry-details">
      <Link to={paths.display()} className={`${BUTTON} self-start`}>
        {t("display.backToBoard")}
      </Link>
      <EntrySummary id={id} occurrence={search.get("occurrence")} discreet />
    </main>
  );
}
