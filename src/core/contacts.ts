import { fold } from "./recipe";

/**
 * A Contact: someone the Family calls or writes to (the paediatrician, the school, the plumber),
 * optionally someone's own (that Person's doctor). Not a Person: never on the calendar.
 */
export type Contact = {
  id: string;
  name: string;
  /** What they are to the Family: "Pediatra", "Escola", "Canalizador". */
  role: string;
  phone: string;
  email: string;
  /** The Person whose contact this is; null for the whole Family. */
  personId: string | null;
  notes: string;
  createdAt: string;
  changedAt: string;
};

export type ContactInput = Pick<
  Contact,
  "name" | "role" | "phone" | "email" | "personId" | "notes"
>;

export const MAX_CONTACT_FIELD = 100;
export const MAX_CONTACT_NOTES = 1000;
const PHONE = /^[+\d][\d\s().-]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A Contact as sent by the browser, cleaned; or the first bad field. */
export function parseContact(
  body: Record<string, unknown>,
): { contact: ContactInput } | { field: string } {
  const text = (key: string, max = MAX_CONTACT_FIELD) => {
    const value = body[key] ?? "";
    return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
  };
  const name = text("name");
  if (!name) return { field: "name" };
  const role = text("role");
  if (role === null) return { field: "role" };
  const phone = text("phone", 30);
  if (phone === null || (phone && !PHONE.test(phone))) return { field: "phone" };
  const email = text("email");
  if (email === null || (email && !EMAIL.test(email))) return { field: "email" };
  const notes = text("notes", MAX_CONTACT_NOTES);
  if (notes === null) return { field: "notes" };
  const personId = body.personId ?? null;
  if (personId !== null && (typeof personId !== "string" || personId.length > 64)) {
    return { field: "personId" };
  }
  return { contact: { name, role, phone, email, personId, notes } };
}

/** The number to dial, digits and a leading "+" only: "tel:+351912345678". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function words(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

function said(phrase: string, inWords: string[]): boolean {
  const want = words(phrase);
  if (want.length === 0 || want.join("").length < 3) return false;
  return inWords.some((_, i) => want.every((w, j) => inWords[i + j] === w));
}

/**
 * The Contacts an Entry is about: those whose name or role its title or place says ("Dentista"
 * on "Dentista da Bia" finds the Contact whose role is Dentista), as whole words, without case
 * or accents.
 */
export function contactsFor<T extends Pick<Contact, "name" | "role">>(
  contacts: T[],
  texts: string[],
): T[] {
  const inWords = texts.flatMap((t) => [...words(t), "\u0000"]);
  return contacts.filter((c) => said(c.name, inWords) || said(c.role, inWords));
}
