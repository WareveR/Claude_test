/**
 * A Gift Idea: something to give one Person, noted by the others for a Birthday, Christmas or
 * any time. Kept from that Person: their own Account never sees ideas for them.
 */
export type GiftIdea = {
  id: string;
  /** Who it is for. */
  personId: string;
  text: string;
  /** A shop page, optional. */
  link: string;
  occasion: GiftOccasion;
  /** When it was given; given ideas stay, struck through, so the same thing isn't given twice. */
  givenOn: string | null;
  createdBy: string | null;
  createdAt: string;
  changedAt: string;
};

export const GIFT_OCCASIONS = ["any", "birthday", "christmas"] as const;
export type GiftOccasion = (typeof GIFT_OCCASIONS)[number];

export type GiftInput = Pick<GiftIdea, "personId" | "text" | "link" | "occasion" | "givenOn">;

export const MAX_GIFT_TEXT = 200;
const MAX_LINK = 500;

function isOccasion(value: unknown): value is GiftOccasion {
  return typeof value === "string" && (GIFT_OCCASIONS as readonly string[]).includes(value);
}

/** A Gift Idea as sent by the browser, cleaned; or the first bad field. */
export function parseGift(body: Record<string, unknown>): { gift: GiftInput } | { field: string } {
  if (typeof body.personId !== "string" || !body.personId) return { field: "personId" };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_GIFT_TEXT) return { field: "text" };
  const link = typeof body.link === "string" ? body.link.trim() : body.link == null ? "" : null;
  if (link === null || link.length > MAX_LINK || (link && !/^https?:\/\/\S+$/i.test(link))) {
    return { field: "link" };
  }
  const occasion = body.occasion ?? "any";
  if (!isOccasion(occasion)) return { field: "occasion" };
  const givenOn = body.givenOn ?? null;
  if (givenOn !== null && (typeof givenOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(givenOn))) {
    return { field: "givenOn" };
  }
  return { gift: { personId: body.personId, text, link, occasion, givenOn } };
}

/** Whether an Account sees ideas for this Person: everyone does but that Person themselves. */
export function seesGiftsFor(viewer: { personId: string | null }, personId: string): boolean {
  return viewer.personId !== personId;
}

/** The ideas for an occasion: those for it and those for any time, ideas not yet given first. */
export function giftsFor(gifts: GiftIdea[], occasion: Exclude<GiftOccasion, "any">): GiftIdea[] {
  return gifts
    .filter((g) => g.occasion === occasion || g.occasion === "any")
    .sort(
      (a, b) =>
        Number(a.givenOn !== null) - Number(b.givenOn !== null) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
