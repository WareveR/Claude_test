// Voice questions about the calendar: when something is, what is on, and the weather.
import { isPlainDate } from "../../core/plain-date";
import { parseVoiceFields } from "../../core/voice";
import { parseVoiceChange } from "../../core/voice-change";
import { agendaAnswer, questionDays, whenAnswer } from "../../core/voice-question";
import { weatherAnswer } from "../../core/voice-weather";
import { seesInFull } from "../private";
import { allEntries } from "../routes/entries";
import { voiceWeather } from "../routes/weather";
import { allTasks, type VoiceState } from "./helpers";

/** "When is the dentist?" or "What is on Friday?": the answer read out. */
export async function questionCommand(state: VoiceState) {
  const { answer, active, types, targets, db, today, viewer, names, language } = state;
  const fields = parseVoiceFields(answer, active.length, types.length);
  const asked = parseVoiceChange(answer, fields, targets.length).targets;
  if (asked.length > 0 && !fields.date) {
    const t = targets[asked[0]];
    return {
      outcome: "answer" as const,
      text: whenAnswer(
        {
          ...t,
          time: t.kind === "task" ? t.time : t.time.allDay ? null : t.time.startTime,
        },
        names,
        language,
      ),
    };
  }
  // Every Entry and Task counts, a Private one hidden from this Account as "Private".
  const [everyEntry, everyTask] = await Promise.all([allEntries(db), allTasks(db)]);
  const { from, to } = questionDays(fields.date, fields.endDate, today);
  const text = agendaAnswer(
    {
      from,
      to,
      startTime: fields.time && fields.endTime && fields.endTime > fields.time ? fields.time : null,
      endTime:
        fields.time && fields.endTime && fields.endTime > fields.time ? fields.endTime : null,
      personIds: fields.persons.length > 0 ? fields.persons.map((i) => active[i].id) : null,
    },
    everyEntry.map((e) => ({ ...e, hidden: !seesInFull(viewer, e, e.personIds) })),
    everyTask.map((t) => ({ ...t, hidden: !seesInFull(viewer, t, t.personIds) })),
    names,
    language,
  );
  return { outcome: "answer" as const, text };
}

/** "What is the weather on Friday?": the forecast read out. */
export async function weatherCommand({ answer, db, now, today, language }: VoiceState) {
  const date = typeof answer.date === "string" && isPlainDate(answer.date) ? answer.date : today;
  const forecast = await voiceWeather(db, now);
  return { outcome: "answer" as const, text: weatherAnswer(date, forecast, language) };
}
