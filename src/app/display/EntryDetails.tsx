import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { EntrySummary } from "../entries/EntrySummary";
import { paths } from "../paths";
import { BUTTON } from "../ui/button";

/**
 * An Entry on the wall: read-only, and a Private one shows only "Private" and its time. Off the
 * wall it is how a Private Entry hidden from this Account opens.
 */
export function EntryDetails({ wall = true }: { wall?: boolean }) {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  // Back to the board as it was, on the week it showed; to today's board when opened directly.
  const back = () =>
    (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(wall ? paths.display() : "/");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6" data-testid="entry-details">
      <button type="button" className={`${BUTTON} self-start`} onClick={back}>
        {wall ? t("display.backToBoard") : t("settings.back")}
      </button>
      <EntrySummary id={id} occurrence={search.get("occurrence")} discreet={wall} />
    </main>
  );
}
