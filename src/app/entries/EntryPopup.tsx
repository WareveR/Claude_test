import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDisplayMode } from "../display/mode";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { EntrySummary } from "./EntrySummary";
import { useEntry } from "./model";

/** An Entry shown over the page, with Edit (not on the wall) and Back; Esc closes too. */
export function EntryPopup({
  id,
  occurrence,
  onClose,
}: {
  id: string;
  occurrence: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const wall = useDisplayMode();
  // A Private Entry hidden from this Account can't be edited.
  const hidden = Boolean(useEntry(id).data?.hidden);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // On the body: the header's stacking would otherwise trap this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-popup-title"
        className="flex max-h-[85dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-frame p-5 sm:rounded-2xl"
      >
        <EntrySummary id={id} occurrence={occurrence} discreet={wall} titleId="entry-popup-title" />
        <div className="flex justify-end gap-2">
          {!wall && !hidden && (
            <Link
              to={`/entries/${id}?occurrence=${occurrence}`}
              className={BUTTON_PRIMARY}
              data-help="edit"
            >
              {t("entries.edit")}
            </Link>
          )}
          <button type="button" className={BUTTON} data-help="back" onClick={onClose}>
            {t("settings.back")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
