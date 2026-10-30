import { foldName } from "./shopping-sections";

/**
 * Reading "comprar leite e ovos", "falta detergente" or "add bread to the shopping list" as
 * things to put on the Shopping List, without the model. A sentence that says a day or a time
 * ("comprar bilhetes para o cinema sábado às 20h") is left alone: it is an Entry or a Task.
 */

/** The most names one sentence adds, and the longest name. */
export const MAX_SHOPPING_NAMES = 30;
const MAX_NAME = 200;

/** Folded words that put a sentence about a day or a time on the calendar instead. */
const WHEN_WORDS = [
  "hoje",
  "amanha",
  "depois de amanha",
  "logo",
  "esta noite",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
  "fim de semana",
  "proxima semana",
  "semana que vem",
  "mes que vem",
  "todos os dias",
  "todas as semanas",
  "todos os meses",
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
  "today",
  "tonight",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "weekend",
  "next week",
  "next month",
  "every day",
  "every week",
  "every month",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "às 20h", "20:30", "8pm", "at 8", "dia 15", "on the 15th". */
const WHEN_PATTERNS = [
  /\b\d{1,2}(:\d{2}| ?h\d{0,2}\b| ?(am|pm)\b)/i,
  /(^|\s)(às|at|by|até|until) \d/i,
  /\b(dia|on the) \d{1,2}\b/i,
  /\b\d{1,2}(st|nd|rd|th)\b/i,
  /\b\d{1,2}[/-]\d{1,2}\b/,
];

/** Whether a sentence says when, which makes it an Entry or a Task. */
export function saysWhen(sentence: string): boolean {
  const folded = ` ${foldName(sentence)} `;
  return (
    WHEN_WORDS.some((word) => folded.includes(` ${word} `)) ||
    WHEN_PATTERNS.some((pattern) => pattern.test(sentence))
  );
}

const LIST = String.raw`(?:(?:à|a|na|para a|pra|p'ra|to|on|onto|in) )?(?:(?:a|the|our|my) )?(?:lista de compras|lista das compras|lista do supermercado|shopping list|grocery list)`;

/** What comes before the things to buy; each leaves them in its first group. */
const LEADS: RegExp[] = [
  // "lista de compras: leite, ovos" / "shopping list: milk"
  /^(?:lista de compras|lista das compras|shopping list)\s*[:,-]\s*(.+)$/i,
  // "adiciona pão à lista de compras", "add bread to the shopping list"
  new RegExp(
    String.raw`^(?:adiciona|adicionar|adicione|acrescenta|acrescentar|acrescente|junta|juntar|junte|põe|poe|pôr|por|ponha|coloca|colocar|coloque|mete|meter|add|put)\s+(.+?)\s+${LIST}(?:\s+(?:please|por favor|se faz favor))?\s*[.!]?$`,
    "i",
  ),
  // "à lista de compras: pão" with the verb first and the list before the things
  new RegExp(
    String.raw`^(?:adiciona|adicionar|adicione|acrescenta|acrescentar|junta|juntar|põe|poe|add|put)\s+${LIST}\s*[:,-]?\s+(.+)$`,
    "i",
  ),
  // "comprar leite e ovos", "buy milk and eggs"
  /^(?:(?:é preciso|e preciso|temos de|tenho de|temos que|tenho que|preciso de|precisamos de)\s+)?(?:comprar|compra|compre|compramos|buy|get some)\s+(.+)$/i,
  // "falta detergente", "faltam ovos", "já não há leite"
  /^(?:já\s+|ja\s+)?(?:falta|faltam|está a faltar|esta a faltar|estão a faltar|estao a faltar)\s+(.+)$/i,
  /^(?:já\s+|ja\s+)?(?:não há|nao ha)\s+(?:mais\s+)?(.+)$/i,
  // "acabou o leite", "acabaram os ovos"
  /^(?:já\s+|ja\s+)?(?:acabaram-se|acabou-se|acabaram|acabou)\s+(.+)$/i,
  // "we need milk", "we're out of eggs", "out of bread"
  /^(?:we need|we're out of|we are out of|we've run out of|we have run out of|we ran out of|out of|i need to buy|we need to buy)\s+(.+)$/i,
];

/**
 * What follows the lead in a sentence about something else: "we need to call the plumber",
 * "falta pagar a luz", "faltam 3 dias para as férias".
 */
const NOT_THINGS =
  /^(?:to|de|para|pagar|ligar|fazer|ir|levar|marcar|tratar|enviar|mandar|limpar|arrumar|ver|call|pay|go|do)\b|\b(?:dias|semanas|meses|horas|minutos|days|weeks|months|hours|minutes)\b/i;

/** Leading words that are not part of a thing's name. */
const LEADING =
  /^(?:(?:o|a|os|as|um|uma|uns|umas|mais|e|the|some|more|an|and|also|também|tambem)\s+)+/i;
/** Trailing words that are not part of a thing's name. */
const TRAILING = new RegExp(
  String.raw`\s+(?:${LIST}|também|tambem|too|please|por favor|se faz favor)\s*$`,
  "i",
);

function cleanName(raw: string): string {
  let name = raw
    .trim()
    .replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«».!?]+$/g, "")
    .trim();
  name = name.replace(TRAILING, "").replace(LEADING, "").trim();
  if (!name) return "";
  return (name[0].toLocaleUpperCase() + name.slice(1)).slice(0, MAX_NAME);
}

/**
 * Splits "leite, ovos e pão" into its things, each once whatever its case or accents, with a
 * capital first letter.
 */
export function splitShoppingNames(text: string): string[] {
  const names: string[] = [];
  for (const part of text.split(/\s*(?:[,;\n+&]|\s(?:e|and|and also|e também|e tambem)\s)\s*/i)) {
    const name = cleanName(part);
    if (!name || names.some((n) => foldName(n) === foldName(name))) continue;
    names.push(name);
    if (names.length === MAX_SHOPPING_NAMES) break;
  }
  return names;
}

/**
 * The things a sentence asks to buy, or null when it isn't about the Shopping List (or says a
 * day or a time, which makes it an Entry or a Task).
 */
export function readShoppingPhrase(sentence: string): string[] | null {
  const text = sentence.trim().replace(/\s+/g, " ");
  if (!text || saysWhen(text)) return null;
  for (const lead of LEADS) {
    const match = lead.exec(text);
    if (!match) continue;
    if (NOT_THINGS.test(match[1])) return null;
    const names = splitShoppingNames(match[1]);
    return names.length > 0 ? names : null;
  }
  return null;
}

/**
 * The names to add, leaving out those already open on the list (whatever their case or
 * accents): `add` to put on the list, `already` there and not bought.
 */
export function shoppingToAdd(
  names: string[],
  items: { name: string; boughtAt: string | null }[],
): { add: string[]; already: string[] } {
  const open = new Set(items.filter((i) => !i.boughtAt).map((i) => foldName(i.name)));
  const add: string[] = [];
  const already: string[] = [];
  for (const name of names) {
    const key = foldName(name);
    if (!key) continue;
    if (open.has(key)) {
      if (!already.some((n) => foldName(n) === key)) already.push(name);
    } else if (!add.some((n) => foldName(n) === key)) {
      add.push(name);
    }
  }
  return { add, already };
}

/** The open items each said name is, matched whatever the case or accents; `missing` matched none. */
export function shoppingMatches<T extends { name: string; boughtAt: string | null }>(
  names: string[],
  items: T[],
): { found: T[]; missing: string[] } {
  const found: T[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const key = foldName(name);
    const item = items.find((i) => !i.boughtAt && foldName(i.name) === key);
    if (!item) missing.push(name);
    else if (!found.includes(item)) found.push(item);
  }
  return { found, missing };
}
