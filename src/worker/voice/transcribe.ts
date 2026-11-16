// Dictation: one recording from the microphone becomes the sentence, read by Workers AI.
import type { Context as HonoContext } from "hono";
import { isLanguage, type Language } from "../../core/languages";
import { transcribe } from "../ai";
import type { AppEnv } from "../types";
import { AI_CALLS_PER_DAY, day, withinLimit } from "../usage";

/** About a minute of compressed speech; a dictated sentence is far shorter. */
export const MAX_RECORDING = 2 * 1024 * 1024;

export async function transcribeVoice(c: HonoContext<AppEnv>) {
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > MAX_RECORDING) return c.json({ error: "invalid", field: "audio" }, 413);
  const audio = await c.req.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_RECORDING) {
    return c.json({ error: "invalid", field: "audio" }, audio.byteLength === 0 ? 400 : 413);
  }
  if (
    !(await withinLimit(
      c.get("db"),
      `ai:${c.get("account").id}`,
      day(c.get("now")),
      AI_CALLS_PER_DAY,
    ))
  ) {
    return c.json({ error: "too_many_requests", retryAfter: 3600 }, 429);
  }
  const asked = c.req.query("language");
  const deviceLanguage = c.get("device").language;
  const language: Language = isLanguage(asked)
    ? asked
    : isLanguage(deviceLanguage)
      ? deviceLanguage
      : "pt-PT";
  const result = await transcribe(c.env, audio, language);
  if ("failed" in result) return c.json({ error: `speech model: ${result.failed}` }, 502);
  return c.json({ text: result.text });
}
