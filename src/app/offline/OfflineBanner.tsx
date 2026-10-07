import { useTranslation } from "react-i18next";
import { useOnline } from "./online";

/** Says the calendar shown is the last loaded one and that edits wait for a connection. */
export function OfflineBanner() {
  const { t } = useTranslation();
  if (useOnline()) return null;
  return (
    <p role="status" className="bg-holiday px-4 py-1 text-center text-sm text-holiday-ink">
      {t("offline.notice")}
    </p>
  );
}
