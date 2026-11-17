// "Deixa um recado: há sopa": a Note on the Wall, said in one sentence.
import { NOTE_COLORS } from "../../core/notes";
import type { Language } from "../../core/languages";
import { randomId } from "../auth/crypto";
import type { Plan } from "./helpers";

const LABEL: Record<Language, string> = { "pt-PT": "Recado", en: "Note" };

/**
 * The plan for a Note read from the sentence: it stays up until the end of tomorrow, in the
 * first colour, and Undo takes it down.
 */
export function noteCommand(text: string, language: Language) {
  const id = randomId();
  const plan: Omit<Plan, "kind"> & { kind: "note" } = {
    kind: "note",
    id,
    date: null,
    label: text,
    summary: `${LABEL[language]}: ${text}`,
    scope: "all",
    apply: {
      all: [
        {
          method: "POST",
          path: "/notes",
          body: { id, text, color: NOTE_COLORS[0], keep: "tomorrow" },
        },
      ],
    },
    undo: [{ method: "DELETE", path: `/notes/${id}` }],
  };
  return { outcome: "change" as const, plan };
}
