import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getReadback, setReadback } from "../voice/speech";

/** Settings › Voice Entry: whether this device reads an Entry back and asks before saving. */
export function VoiceSection() {
  const { t } = useTranslation();
  const [on, setOn] = useState(getReadback);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("voice.title")}</h2>
      <p className="text-sm text-muted">{t("voice.hint")}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setReadback(e.target.checked);
          }}
        />
        {t("voice.readback")}
      </label>
    </section>
  );
}
