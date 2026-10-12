import { fold } from "./search";

/** What a new item is kept as: an Entry on the calendar or a Task to tick off. */
export type NewKind = "entry" | "task";

/** A clock time in the words: "15:30", "15h", "às 3", "at 3pm", "3 pm". */
const CLOCK = /\b\d{1,2}(:\d{2}|h\d{0,2}\b|\s?(am|pm)\b)|\b(as|at)\s\d{1,2}\b/;

/** Words that start something to get done, in Portuguese and English. */
const TO_DO = new Set([
  // Portuguese, as infinitives
  "comprar",
  "pagar",
  "ligar",
  "telefonar",
  "enviar",
  "mandar",
  "levar",
  "buscar",
  "tratar",
  "renovar",
  "limpar",
  "arrumar",
  "lavar",
  "fazer",
  "marcar",
  "preparar",
  "entregar",
  "devolver",
  "trocar",
  "arranjar",
  "reparar",
  "responder",
  "escrever",
  "pedir",
  "reservar",
  "cancelar",
  "lembrar",
  "verificar",
  "imprimir",
  "regar",
  "estudar",
  "submeter",
  "inscrever",
  "agendar",
  // English, as imperatives
  "buy",
  "pay",
  "call",
  "phone",
  "send",
  "post",
  "take",
  "pick",
  "fetch",
  "renew",
  "clean",
  "tidy",
  "wash",
  "do",
  "book",
  "prepare",
  "return",
  "fix",
  "repair",
  "reply",
  "write",
  "order",
  "cancel",
  "check",
  "print",
  "water",
  "study",
  "submit",
  "register",
  "schedule",
]);

/**
 * Guesses from a new item's title whether it is an Entry or a Task: a clock time means an
 * Entry, and a title starting with something to do ("Comprar pão", "Pay the IUC") a Task.
 * Null when the words don't say.
 */
export function guessKind(title: string): NewKind | null {
  const words = fold(title).trim();
  if (CLOCK.test(words)) return "entry";
  const first = words.split(/[\s,.:;!?]+/)[0] ?? "";
  return TO_DO.has(first) ? "task" : null;
}
