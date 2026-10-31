/** How a spoken voice sounds on this device: which voice, how fast, how high. */
export type VoiceSettings = {
  /** The chosen voice's `voiceURI`, or null to let the app pick. */
  voice: string | null;
  rate: number;
  pitch: number;
};

export const DEFAULT_VOICE: VoiceSettings = { voice: null, rate: 1, pitch: 1 };

/** The slider ranges; past them most voices garble or barely change. */
export const RATE_RANGE = { min: 0.7, max: 1.5, step: 0.05 } as const;
export const PITCH_RANGE = { min: 0.6, max: 1.6, step: 0.05 } as const;

/** The parts of a browser voice this needs, so it can be tested without one. */
export type VoiceLike = { voiceURI: string; name: string; lang: string; localService: boolean };

const clamp = (n: unknown, r: { min: number; max: number }, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : fallback;

/** Settings read back from storage, with anything missing or out of range made sensible. */
export function readVoiceSettings(raw: string | null): VoiceSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<VoiceSettings>) : {};
    return {
      voice: typeof v.voice === "string" && v.voice ? v.voice : null,
      rate: clamp(v.rate, RATE_RANGE, DEFAULT_VOICE.rate),
      pitch: clamp(v.pitch, PITCH_RANGE, DEFAULT_VOICE.pitch),
    };
  } catch {
    return DEFAULT_VOICE;
  }
}

const sameLang = (voiceLang: string, lang: string) =>
  voiceLang.replace("_", "-").toLowerCase() === lang.toLowerCase();

/** Natural, Neural and Online voices are the modern ones; they sound far less robotic. */
const NATURAL = /natural|neural|online|enhanced|premium|wavenet/i;

const rank = (v: VoiceLike) => (NATURAL.test(v.name) ? 0 : v.localService ? 2 : 1);

/**
 * The device's voices for exactly this language, best first: natural-sounding, then network,
 * then local ones. Exact, so Portugal's Portuguese is never read by a Brazilian voice.
 */
export function voicesFor<V extends VoiceLike>(voices: readonly V[], lang: string): V[] {
  return voices
    .filter((v) => sameLang(v.lang, lang))
    .map((v, i) => ({ v, i }))
    .sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i)
    .map(({ v }) => v);
}

/** The chosen voice when the device still has it in this language, otherwise the best one. */
export function pickVoice<V extends VoiceLike>(
  voices: readonly V[],
  lang: string,
  chosen: string | null,
): V | undefined {
  const mine = voicesFor(voices, lang);
  return mine.find((v) => v.voiceURI === chosen) ?? mine[0];
}
