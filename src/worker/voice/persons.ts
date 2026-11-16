// Voice commands that create a Person or a predefined list.
import { MAX_TEMPLATE_ITEMS, MAX_TEMPLATE_TEXT, templateText } from "../../core/checklist-template";
import { freeColor } from "../../core/person-colors";
import { isPlainDate } from "../../core/plain-date";
import { personSummary, templateSummary } from "../../core/voice";
import type { VoiceState } from "./helpers";

/** A new Person, with the Nicknames said, unless the name is already taken. */
export function personCommand({ answer, persons, nicknames, today, language, failed }: VoiceState) {
  const name = typeof answer.title === "string" ? answer.title.trim().slice(0, 100) : "";
  if (!name) return failed;
  const known = (n: string) => n.trim().toLocaleLowerCase();
  const taken = new Set(
    [...persons.map((p) => p.name), ...nicknames.map((n) => n.nickname)].map(known),
  );
  if (taken.has(known(name))) return { outcome: "personExists" as const };
  const born = typeof answer.date === "string" && isPlainDate(answer.date) ? answer.date : null;
  const values = {
    name,
    color: freeColor(persons.filter((p) => !p.archived).map((p) => p.color)),
    photoKey: null,
    dateOfBirth: born && born <= today ? born : null,
    nicknames: [
      ...new Set(
        (Array.isArray(answer.nicknames) ? answer.nicknames : [])
          .filter((n): n is string => typeof n === "string")
          .map((n) => n.trim())
          .filter((n) => n && known(n) !== known(name)),
      ),
    ].slice(0, 10),
  };
  return {
    outcome: "create" as const,
    kind: "person" as const,
    values,
    summary: personSummary(values, language),
  };
}

/** A new predefined list, unless one of the name exists. */
export function listCommand({ answer, templates, language, failed }: VoiceState) {
  const name = typeof answer.title === "string" ? answer.title.trim() : "";
  if (!name || name.length > MAX_TEMPLATE_TEXT) return failed;
  const known = (n: string) => n.trim().toLocaleLowerCase();
  if (templates.some((t) => known(templateText(t, language).name) === known(name))) {
    return { outcome: "listExists" as const };
  }
  const items = [
    ...new Set(
      (Array.isArray(answer.items) ? answer.items : [])
        .filter((i): i is string => typeof i === "string")
        .map((i) => i.trim().slice(0, MAX_TEMPLATE_TEXT))
        .filter(Boolean),
    ),
  ].slice(0, MAX_TEMPLATE_ITEMS);
  const values = { name, items };
  return {
    outcome: "create" as const,
    kind: "template" as const,
    values,
    summary: templateSummary(values, language),
  };
}
