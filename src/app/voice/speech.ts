import { readbackSentences } from "../../core/readback";
import { ApiError, NetworkError } from "../api";
import { reportFailure } from "../errors/store";

/**
 * Thin, failure-proof wrappers over the browser's microphone and speech APIs; every call may be
 * absent or throw. Dictation records here and Workers AI turns the recording into text, so the
 * audio never goes to the browser's own speech service (Google in Chrome, Apple in Safari).
 */

export const canListen = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== "undefined";

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

/** Speech is this many times louder than the room's own noise… */
const SPEECH_OVER_NOISE = 3;
/** …and never quieter than this (0 silent … 1 full scale). */
const SPEECH_LEVEL = 0.015;
/** How long the room is measured before listening for speech. */
const CALIBRATE_MS = 300;
/** Quiet this long after speech ends the recording, as the browser's recognizer did. */
const QUIET_MS = 1300;
/** No speech at all for this long gives up. */
const WAIT_MS = 8000;
/** A dictated sentence never runs longer. */
const MAX_MS = 20000;
/** Without a working level meter nothing hears the quiet, so stop sooner. */
const UNMETERED_MS = 10000;

let current: { recorder: MediaRecorder; keep: boolean } | null = null;
/** Bumped by every stop, so a listen still waiting for the microphone gives up once it gets it. */
let listening = 0;

/** Ends the current listening and throws away what was recorded. */
export function stopListening() {
  listening++;
  const now = current;
  current = null;
  if (!now) return;
  now.keep = false;
  try {
    if (now.recorder.state !== "inactive") now.recorder.stop();
  } catch {
    // Nothing to stop.
  }
}

/** Ends the current listening and keeps what was heard so far. */
export function finishListening() {
  try {
    if (current && current.recorder.state !== "inactive") current.recorder.stop();
  } catch {
    // Nothing to stop.
  }
}

/** Why listening heard nothing: "denied" when the microphone is blocked, else a short code. */
export type Heard = { text: string | null; error: "denied" | string | null };

/**
 * Listens once: records until the speaker falls quiet (or the button is pressed again), then has
 * Workers AI read the recording. Resolves with what it heard (or null) and why not; `onReading`
 * runs when the recording ends and is sent, and `onWords` gets the sentence once it is read.
 */
export async function listen(
  lang: string,
  onWords?: (words: string) => void,
  onReading?: () => void,
): Promise<Heard> {
  if (!canListen()) return { text: null, error: "unsupported" };
  stopListening();
  const mine = listening;
  // Made before the microphone prompt, while the tap still counts: browsers keep an audio
  // context made later suspended, and a suspended meter can't hear the speaker fall quiet.
  const audio = startAudio();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    void audio?.close().catch(() => undefined);
    const name = (error as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError")
      return { text: null, error: "denied" };
    reportFailure(error, "app", "microphone");
    return { text: null, error: "no-microphone" };
  }
  if (mine !== listening) {
    for (const track of stream.getTracks()) track.stop();
    void audio?.close().catch(() => undefined);
    return { text: null, error: "aborted" };
  }
  let recording: { audio: Blob; kept: boolean };
  try {
    recording = await record(stream, audio);
  } catch (error) {
    reportFailure(error, "app", "recording");
    return { text: null, error: "error" };
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
  if (!recording.kept) return { text: null, error: "aborted" };
  // Even when the meter heard no speech, Workers AI listens: a soft voice may sit under it.
  if (recording.audio.size === 0) return { text: null, error: "silence" };
  onReading?.();
  try {
    const res = await fetch(`/api/voice/transcribe?language=${encodeURIComponent(lang)}`, {
      method: "POST",
      headers: { "Content-Type": recording.audio.type || "application/octet-stream" },
      body: recording.audio,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      reportFailure(new ApiError(res.status, body, "POST /voice/transcribe"), "app");
      return { text: null, error: `server-${res.status}` };
    }
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return { text: null, error: "silence" };
    onWords?.(text);
    return { text, error: null };
  } catch (error) {
    reportFailure(new NetworkError("POST /voice/transcribe", error), "app");
    return { text: null, error: "network" };
  }
}

/** Records one stream until quiet, the time limit, or finishListening/stopListening. */
function record(
  stream: MediaStream,
  audio: AudioContext | null,
): Promise<{ audio: Blob; kept: boolean }> {
  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const level = meter(stream, audio);
    const mine = { recorder, keep: true };
    current = mine;
    const started = Date.now();
    let spoke = false;
    let metered = false;
    let lastSound = started;
    // The room's noise: follows the level down at once and up only slowly, so speech doesn't
    // count as noise but a phone's gain control raising the hiss between words does.
    let noise = Infinity;
    const timer = setInterval(() => {
      const now = Date.now();
      // A meter the browser keeps suspended hears nothing, so it can't end the recording either.
      metered = level.audio?.state === "running";
      if (!metered) return void (now - started > UNMETERED_MS && finishListening());
      const loud = level.read();
      noise = loud < noise ? loud : noise + (loud - noise) * 0.02;
      // The first moments, before anyone speaks, only measure the room.
      if (now - started < CALIBRATE_MS) return;
      if (loud > Math.max(SPEECH_LEVEL, noise * SPEECH_OVER_NOISE)) {
        spoke = true;
        lastSound = now;
      }
      const done = spoke ? now - lastSound > QUIET_MS : now - started > WAIT_MS;
      if (done || now - started > MAX_MS) finishListening();
    }, 100);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearInterval(timer);
      void level.audio?.close().catch(() => undefined);
      if (current === mine) current = null;
      resolve({
        audio: new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "" }),
        kept: mine.keep,
      });
    };
    recorder.onerror = () => {
      clearInterval(timer);
      if (current === mine) current = null;
      reject(new Error("recorder"));
    };
    recorder.start();
  });
}

/** An audio context asked to run at once; null where Web Audio is missing. */
function startAudio(): AudioContext | null {
  try {
    const audio = new AudioContext();
    void audio.resume().catch(() => undefined);
    return audio;
  } catch {
    return null;
  }
}

/** How loud the microphone is right now, 0 … 1; always 0 without an audio context. */
function meter(
  stream: MediaStream,
  audio: AudioContext | null,
): { audio: AudioContext | null; read: () => number } {
  if (!audio) return { audio: null, read: () => 0 };
  try {
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    // A context the browser started suspended may still be allowed to run now.
    if (audio.state !== "running") void audio.resume().catch(() => undefined);
    const samples = new Uint8Array(analyser.fftSize);
    return {
      audio,
      read: () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += ((v - 128) / 128) ** 2;
        return Math.sqrt(sum / samples.length);
      },
    };
  } catch {
    void audio.close().catch(() => undefined);
    return { audio: null, read: () => 0 };
  }
}

/** Listens once; resolves to the transcript, or null on silence, error or no support. */
export function listenOnce(lang: string): Promise<string | null> {
  return listen(lang).then((r) => r.text);
}

/** Bumped by every new readback and by stopSpeaking, so an older one stops between sentences. */
let speaking = 0;

/** The silence between two sentences, so a summary and its question never run together. */
const PAUSE_MS = 400;

/**
 * Speaks each sentence in turn with a short pause between them; resolves when done (or at once if
 * speech is unavailable or stalls).
 */
export function speak(parts: string | string[], lang: string): Promise<void> {
  const sentences = readbackSentences(parts);
  return new Promise((resolve) => {
    try {
      if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined")
        return resolve();
      speechSynthesis.cancel();
      const id = ++speaking;
      const timer = setTimeout(resolve, 20000 + sentences.length * PAUSE_MS);
      const finish = () => {
        clearTimeout(timer);
        resolve();
      };
      const next = (i: number) => {
        if (id !== speaking || i >= sentences.length) return finish();
        const u = new SpeechSynthesisUtterance(sentences[i]);
        u.lang = lang;
        u.onend = () => setTimeout(() => next(i + 1), i + 1 < sentences.length ? PAUSE_MS : 0);
        u.onerror = finish;
        speechSynthesis.speak(u);
      };
      next(0);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking() {
  speaking++;
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
