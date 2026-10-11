import { useTranslation } from "react-i18next";
import { HELP_LEVELS, type HelpLevel } from "../../core/help";
import { setHelpLevel, useHelpLevel } from "../help/level";

/** Settings › This device: how much the main buttons and fields explain when hovered. */
export function HelpSection() {
  const { t } = useTranslation();
  const level = useHelpLevel();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("help.title")}</h2>
      <p className="text-sm text-muted">{t("help.hint")}</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("help.level")}</span>
        <select
          value={level}
          onChange={(e) => setHelpLevel(e.target.value as HelpLevel)}
          className="rounded-md border border-line bg-surface px-3 py-2"
        >
          {HELP_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`help.levels.${l}`)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
