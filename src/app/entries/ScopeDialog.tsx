import { useTranslation } from "react-i18next";
import { BUTTON } from "../ui/button";

export type Scope = "this" | "following" | "all";

/** Asks which Occurrences of a repeating Entry an edit or deletion applies to. */
export function ScopeDialog({
  action,
  allowThis,
  onPick,
  onCancel,
}: {
  action: "save" | "delete";
  allowThis: boolean;
  onPick: (scope: Scope) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const button = "rounded-md border border-line px-4 py-2 text-left disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-title"
        className="flex w-full max-w-sm flex-col gap-2 rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
      >
        <h2 id="scope-title" className="font-semibold">
          {t(action === "save" ? "scope.saveTitle" : "scope.deleteTitle")}
        </h2>
        <button
          type="button"
          className={button}
          disabled={!allowThis}
          onClick={() => onPick("this")}
        >
          {t("scope.this")}
        </button>
        <button type="button" className={button} onClick={() => onPick("following")}>
          {t("scope.following")}
        </button>
        <button type="button" className={button} onClick={() => onPick("all")}>
          {t("scope.all")}
        </button>
        <button type="button" className={`${BUTTON} mt-1 self-end`} onClick={onCancel}>
          {t("scope.cancel")}
        </button>
      </div>
    </div>
  );
}
