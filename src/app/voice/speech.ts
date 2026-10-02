/** Thin, failure-proof wrappers over the browser's speech APIs; every call may be absent or throw. */

type Alternative = { transcript: string };
type RecognitionEvent = { results: ArrayLike<ArrayLike<Alternative>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
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

/** Listens once; resolves to the transcript, or null on silence, error or no support. */
export function listenOnce(lang: string): Promise<string | null> {
  return new Promise((resolve) => {
    const Ctor = recognitionClass();
    if (!Ctor) return resolve(null);
    try {
      stopListening();
      const rec = new Ctor();
      current = rec;
      let heard: string | null = null;
      rec.lang = lang;
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        heard = e.results[0]?.[0]?.transcript?.trim() || null;
      };
      rec.onerror = () => resolve(heard);
      rec.onend = () => resolve(heard);
      rec.start();
    } catch {
      resolve(null);
    }
  });
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
