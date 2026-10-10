/** Thin, failure-proof wrappers over the browser's speech APIs; every call may be absent or throw. */

type Alternative = { transcript: string };
type RecognitionEvent = { results: ArrayLike<ArrayLike<Alternative>> };
type RecognitionError = { error?: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

export const canListen = () => Boolean(recognitionClass());

const READBACK_KEY = "voice-readback";

/** Whether this device reads a Voice Entry back before saving; on unless switched off. */
export function getReadback(): boolean {
  try {
    return localStorage.getItem(READBACK_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setReadback(on: boolean) {
  try {
    localStorage.setItem(READBACK_KEY, on ? "on" : "off");
  } catch {
    // Storage may be blocked; the choice then lasts only until reload.
  }
}

let current: Recognition | null = null;

export function stopListening() {
  try {
    current?.abort();
  } catch {
    // Nothing to stop.
  }
  current = null;
}

/** Ends the current listening and keeps what was heard so far. */
export function finishListening() {
  try {
    current?.stop();
  } catch {
    // Nothing to stop.
  }
}

/** Why listening heard nothing: "denied" when the microphone is blocked, else the browser's code. */
export type Heard = { text: string | null; error: "denied" | string | null };

/**
 * Listens once; resolves when the browser stops listening, with what it heard (or null) and why
 * not. Interim results are on because iOS Safari often ends without ever marking a result final;
 * the last words heard are kept and passed to `onWords` as they come.
 */
export function listen(lang: string, onWords?: (words: string) => void): Promise<Heard> {
  return new Promise((resolve) => {
    const Ctor = recognitionClass();
    if (!Ctor) return resolve({ text: null, error: "unsupported" });
    try {
      stopListening();
      const rec = new Ctor();
      current = rec;
      let heard: string | null = null;
      let error: string | null = null;
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const words = Array.from(e.results, (r) => r[0]?.transcript ?? "")
          .join("")
          .trim();
        if (!words) return;
        heard = words;
        onWords?.(words);
      };
      rec.onerror = (e) => {
        const code = e?.error ?? "error";
        error = code === "not-allowed" ? "denied" : code;
      };
      rec.onend = () => {
        if (current === rec) current = null;
        resolve({ text: heard, error: heard ? null : error });
      };
      rec.start();
    } catch {
      resolve({ text: null, error: "error" });
    }
  });
}

/** Listens once; resolves to the transcript, or null on silence, error or no support. */
export function listenOnce(lang: string): Promise<string | null> {
  return listen(lang).then((r) => r.text);
}

/** Speaks the text; resolves when done (or at once if speech is unavailable or stalls). */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined")
        return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const timer = setTimeout(resolve, 20000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking() {
  try {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Reads a spoken answer to "Save?": true only for a clear yes. */
export function isYes(answer: string | null): boolean {
  if (!answer) return false;
  const s = plain(answer);
  if (/\b(no|nao|not|nope)\b/.test(s)) return false;
  return /\b(yes|sim|guarda|guardar|save)\b/.test(s);
}

/** Reads a spoken answer to "Save?": true for a clear no or a wish to edit. */
export function wantsEdit(answer: string | null): boolean {
  if (!answer) return false;
  const s = plain(answer);
  return /\b(no|nao|nope|edit|editar|edita|change|mudar|muda|alterar|altera)\b/.test(s);
}

const NUMBERS: [number, RegExp][] = [
  [0, /\b(1|one|first|um|uma|primeiro|primeira)\b/],
  [1, /\b(2|two|second|dois|duas|segundo|segunda)\b/],
  [2, /\b(3|three|third|tres|terceiro|terceira)\b/],
];

/** Reads a spoken answer to "Which one?": a number or ordinal, else the option's title words. */
export function matchOption(answer: string | null, labels: string[]): number | null {
  if (!answer) return null;
  const s = plain(answer);
  const numbered = NUMBERS.filter(([i, re]) => i < labels.length && re.test(s)).map(([i]) => i);
  if (numbered.length === 1) return numbered[0] ?? null;
  if (numbered.length > 1) return null;
  const words = new Set(s.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const scores = labels.map(
    (label) =>
      plain(label)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => words.has(w)).length,
  );
  const best = Math.max(...scores);
  if (best === 0 || scores.filter((n) => n === best).length > 1) return null;
  return scores.indexOf(best);
}

/** Reads a spoken answer to "Only this time or from now on?"; null when unclear. */
export function matchScope(answer: string | null): "this" | "following" | null {
  if (!answer) return null;
  const s = plain(answer);
  const following =
    /\b(from now on|daqui em diante|a partir de agora|always|sempre|following)\b/.test(s);
  const only = /\b(only this|just this|this time|so esta|so este|esta vez|desta vez)\b/.test(s);
  if (following === only) return null;
  return following ? "following" : "this";
}
