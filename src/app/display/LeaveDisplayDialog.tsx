import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { setDisplayMode } from "./mode";

/** Asks before a long press on the header takes the tablet out of Display Mode. */
export function LeaveDisplayDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  // On the body, not inside the blurred header, which would trap a fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-display-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-frame p-5"
      >
        <h2 id="leave-display-title" className="text-lg font-semibold">
          {t("display.leaveTitle")}
        </h2>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-line px-4 py-2"
            onClick={onClose}
          >
            {t("display.stay")}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
            onClick={() => {
              onClose();
              setDisplayMode(false);
            }}
          >
            {t("display.leave")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
