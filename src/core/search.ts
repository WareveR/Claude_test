/**
 * The search box's little language: loose words match any of them, "quoted text" must appear
 * as written, and -word (or -"quoted text") leaves out what contains it. Case and accents never
 * matter, so "reuniao" finds "Reunião".
 */
export type SearchQuery = {
  /** Loose words: an item needs at least one; more of them rank it higher. */
  words: string[];
  /** Quoted text: an item needs every one, as written. */
  phrases: string[];
  /** Words or quoted text after a minus: an item with any of them is left out. */
  excluded: string[];
};

/** Lower case without accents, one character for each character in, so positions line up. */
export function fold(text: string): string {
  let out = "";
  for (const char of text) {
    const folded = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += folded.length === 1 ? folded : char;
  }
  return out;
}

export function parseQuery(input: string): SearchQuery {
  const query: SearchQuery = { words: [], phrases: [], excluded: [] };
  // A quote left open runs to the end, so typing `"dentista` already searches for it.
  for (const [, minus, quoted, word] of input.matchAll(/(-?)(?:"([^"]*)"?|(\S+))/g)) {
    const text = fold((quoted ?? word ?? "").trim());
    if (!text || text === "-") continue;
    if (minus) query.excluded.push(text);
    else if (quoted !== undefined) query.phrases.push(text);
    else query.words.push(text);
  }
  return query;
}

export function isEmptyQuery(query: SearchQuery): boolean {
  return query.words.length + query.phrases.length + query.excluded.length === 0;
}

/** What an item is searched by: its name counts more than the rest. */
export type Searchable = { title: string; other: string[] };

/**
 * How well an item matches: null when it doesn't (an excluded term, a missing phrase, or none of
 * the words), else a score that grows with each word and phrase found, double in the title.
 * A query with only exclusions matches whatever they don't rule out.
 */
export function scoreItem(item: Searchable, query: SearchQuery): number | null {
  const title = fold(item.title);
  const all = [title, ...item.other.map(fold)].join("\n");
  if (query.excluded.some((term) => all.includes(term))) return null;
  if (!query.phrases.every((phrase) => all.includes(phrase))) return null;
  const found = query.words.filter((word) => all.includes(word));
  if (query.words.length > 0 && found.length === 0) return null;
  const weight = (term: string) => (title.includes(term) ? 2 : 1);
  return (
    found.reduce((sum, word) => sum + weight(word), 0) +
    query.phrases.reduce((sum, phrase) => sum + 2 * weight(phrase), 0)
  );
}

/** The terms to highlight: the words and phrases looked for, longest first. */
export function highlightTerms(query: SearchQuery): string[] {
  return [...query.phrases, ...query.words].sort((a, b) => b.length - a.length);
}

/** Splits text into plain and matching parts, for showing what matched. */
export function highlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const folded = fold(text);
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  let plain = 0;
  while (at < text.length) {
    const term = terms.find((t) => t && folded.startsWith(t, at));
    if (!term) {
      at += 1;
      continue;
    }
    if (at > plain) parts.push({ text: text.slice(plain, at), hit: false });
    parts.push({ text: text.slice(at, at + term.length), hit: true });
    at += term.length;
    plain = at;
  }
  if (plain < text.length) parts.push({ text: text.slice(plain), hit: false });
  return parts;
}

/** A short piece of longer text around its first match, or its start when nothing matches. */
export function excerpt(text: string, terms: string[], room = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const folded = fold(flat);
  const hits = terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0);
  const first = hits.length > 0 ? Math.min(...hits) : 0;
  const start = Math.max(0, first - Math.floor(room / 3));
  const end = Math.min(flat.length, start + room);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}
