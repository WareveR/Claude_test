/** Lower case without accents, so "Não" and "nao" read the same. */
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const words = (s: string) =>
  plain(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const only = (said: string[], allowed: Set<string>) => said.every((w) => allowed.has(w));
const YES = new Set([
  "yes",
  "sim",
  "guarda",
  "guardar",
  "guardo",
  "save",
  "it",
  "ok",
  "okay",
  "pode",
  "podes",
  "isso",
  "claro",
  "confirmo",
  "confirma",
  "certo",
  "esta",
  "bem",
  "por",
  "favor",
  "please",
  "sure",
  "yeah",
  "yep",
  "sounds",
  "good",
  "e",
  "assim",
  "obrigado",
  "obrigada",
]);
const NO = new Set(["no", "nao", "nope", "not"]);
const CANCEL = /\b(cancela|cancelar|cancel|esquece|esqueca|forget|deixa|desiste)\b/;
const FORM = /\b(edit|editar|edita|formulario|form)\b/;

/**
 * Reads a spoken answer to "Save it, or change something?": a plain yes saves, a plain no asks
 * what to change, "cancel" drops it, "edit" opens the form, and anything else is a correction
 * ("no, at eleven", "add Maria") to apply before asking again.
 */
export function readAnswer(
  answer: string | null,
): "silence" | "yes" | "no" | "cancel" | "form" | { correction: string } {
  const said = answer ? words(answer) : [];
  if (said.length === 0) return "silence";
  if (said.some((w) => YES.has(w) && !["it", "e", "por", "esta"].includes(w)) && only(said, YES))
    return "yes";
  if (only(said, NO)) return "no";
  const s = said.join(" ");
  if (said.length <= 4 && CANCEL.test(s)) return "cancel";
  if (said.length <= 3 && FORM.test(s)) return "form";
  return { correction: answer!.trim() };
}
