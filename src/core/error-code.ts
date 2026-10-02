/** Letters and digits that can't be mistaken for one another when read aloud or copied. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A short code the Family can quote, like ERR-7F3K. */
export function newErrorCode(random: () => number = Math.random): string {
  let code = "ERR-";
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export function isErrorCode(value: unknown): value is string {
  return typeof value === "string" && /^ERR-[2-9A-HJ-NP-Z]{4}$/.test(value);
}
