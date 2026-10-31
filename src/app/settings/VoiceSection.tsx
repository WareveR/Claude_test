import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_VOICE,
  PITCH_RANGE,
  RATE_RANGE,
  voicesFor,
  type VoiceSettings,
} from "../../core/voice-choice";
import {
  canSpeak,
  deviceVoices,
  getReadback,
  getVoiceSettings,
  onVoicesChanged,
  setReadback,
  setVoiceSettings,
  speak,
  stopSpeaking,
} from "../voice/speech";
import { Switch } from "../ui/Toggle";
import { Field } from "../screens/form";

const SELECT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";
const BUTTON = "rounded-md border border-line px-3 py-1.5 text-sm";

/**
 * Settings › Voice Entry: whether this device reads an Entry back and asks before saving, and how
 * it sounds.
 */
export function VoiceSection() {
  const { t } = useTranslation();
  const [on, setOn] = useState(getReadback);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("voice.title")}</h2>
      <p className="text-sm text-muted">{t("voice.hint")}</p>
      <label className="flex items-center gap-2">
        <Switch
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setReadback(e.target.checked);
          }}
        />
        {t("voice.readback")}
      </label>
      {canSpeak() && <SoundSettings />}
    </section>
  );
}

const asPercent = (n: number) => `${Math.round(n * 100)}%`;

/** Which of this device's voices for the app's language speaks, how fast and how high, with a preview. */
function SoundSettings() {
  const { t, i18n } = useTranslation();
  const [sound, setSound] = useState(getVoiceSettings);
  const [all, setAll] = useState(deviceVoices);
  // Chrome lists its voices only after a moment, and again when an online voice arrives.
  useEffect(() => onVoicesChanged(() => setAll(deviceVoices())), []);
  useEffect(() => () => stopSpeaking(), []);
  const voices = voicesFor(all, i18n.language);

  const change = (next: VoiceSettings) => {
    setSound(next);
    setVoiceSettings(next);
  };
  const preview = (next = sound) => void speak(t("voice.sample"), i18n.language, {}, next);

  return (
    <div className="flex flex-col gap-3" data-testid="voice-sound">
      <h3 className="font-medium">{t("voice.sound")}</h3>
      <p className="text-sm text-muted">{t("voice.soundHint")}</p>
      {voices.length === 0 ? (
        <p className="text-sm text-muted">{t("voice.noVoices")}</p>
      ) : (
        <Field label={t("voice.voice")}>
          <select
            className={SELECT}
            value={voices.some((v) => v.voiceURI === sound.voice) ? (sound.voice ?? "") : ""}
            onChange={(e) => {
              const next = { ...sound, voice: e.target.value || null };
              change(next);
              preview(next);
            }}
          >
            <option value="">{t("voice.voiceAuto")}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.localService ? v.name : `${v.name} (${t("voice.voiceOnline")})`}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Slider
        label={t("voice.rate")}
        value={sound.rate}
        range={RATE_RANGE}
        onChange={(rate) => change({ ...sound, rate })}
      />
      <Slider
        label={t("voice.pitch")}
        value={sound.pitch}
        range={PITCH_RANGE}
        onChange={(pitch) => change({ ...sound, pitch })}
      />
      <div className="flex gap-2">
        <button type="button" className={BUTTON} onClick={() => preview()}>
          {t("voice.preview")}
        </button>
        <button type="button" className={BUTTON} onClick={() => change(DEFAULT_VOICE)}>
          {t("voice.reset")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("voice.androidHint")}</p>
    </div>
  );
}

function Slider({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        {label}
        <span className="text-muted">{asPercent(value)}</span>
      </span>
      <input
        type="range"
        className="accent-accent"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
