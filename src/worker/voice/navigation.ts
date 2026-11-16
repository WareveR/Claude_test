// Voice commands that take the Family somewhere: the daily briefing and places in the app to open.
import { parseVoiceFields } from "../../core/voice";
import { parseVoiceOpen } from "../../core/voice-open";
import type { VoiceState } from "./helpers";

/** "Read me the day": the briefing, for one Person when exactly one is named. */
export function briefingCommand({ answer, active, types }: VoiceState) {
  const fields = parseVoiceFields(answer, active.length, types.length);
  const person = fields.persons.length === 1 ? active[fields.persons[0]].id : null;
  return { outcome: "briefing" as const, person };
}

/** "Open the shopping list": a place in the app. */
export function openCommand({ answer, failed }: VoiceState) {
  const open = parseVoiceOpen(answer);
  return open ? { outcome: "open" as const, ...open } : failed;
}
