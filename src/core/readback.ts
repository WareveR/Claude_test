/**
 * Splits what the readback says into sentences, each ending in its own punctuation, so the voice
 * stops between them: "Entry: Consulta, 20 October, 19:00." then "Save?", never one run-on line.
 */
export function readbackSentences(parts: string | string[]): string[] {
  return (Array.isArray(parts) ? parts : [parts])
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/[.!?…:;]$/.test(part) ? part : `${part}.`));
}
