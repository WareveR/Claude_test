/**
 * A Lift: who takes ("leva") and who picks up ("vai buscar") the Persons of an Entry, usually a
 * child's. Set on the Entry for all its Occurrences; an Entry with a Lift whose taker or picker
 * is still missing says so on the calendar.
 */
export type Lift = { entryId: string; dropOffId: string | null; pickUpId: string | null };

export type LiftRole = "dropOff" | "pickUp";

/** A Lift as sent by the browser; or the first bad field. */
export function parseLift(
  body: Record<string, unknown>,
): { lift: Pick<Lift, "dropOffId" | "pickUpId"> } | { field: string } {
  const person = (value: unknown) =>
    value === undefined || value === null
      ? null
      : typeof value === "string" && value
        ? value
        : false;
  const dropOffId = person(body.dropOffId);
  if (dropOffId === false) return { field: "dropOffId" };
  const pickUpId = person(body.pickUpId);
  if (pickUpId === false) return { field: "pickUpId" };
  return { lift: { dropOffId, pickUpId } };
}

/** Who is still missing: nobody to take them, nobody to pick them up, or both. */
export function liftMissing(lift: Pick<Lift, "dropOffId" | "pickUpId">): LiftRole[] {
  return [
    ...(lift.dropOffId === null ? (["dropOff"] as const) : []),
    ...(lift.pickUpId === null ? (["pickUp"] as const) : []),
  ];
}

/** A timed thing on one day: its start and end as "HH:MM" ("24:00" past midnight). */
export type Busy = { id: string; title: string; personIds: string[]; start: string; end: string };

/**
 * The taker or picker who has something else on at that moment: the taker at the Entry's start,
 * the picker at its end (something starting just as it ends counts).
 */
export function liftClashes(
  lift: Pick<Lift, "entryId" | "dropOffId" | "pickUpId">,
  at: { start: string; end: string },
  others: Busy[],
): { role: LiftRole; personId: string; title: string }[] {
  const out: { role: LiftRole; personId: string; title: string }[] = [];
  const check = (role: LiftRole, personId: string | null, moment: string) => {
    if (personId === null) return;
    const busy = others.find(
      (o) =>
        o.id !== lift.entryId &&
        o.personIds.includes(personId) &&
        o.start <= moment &&
        moment < o.end,
    );
    if (busy) out.push({ role, personId, title: busy.title });
  };
  check("dropOff", lift.dropOffId, at.start);
  check("pickUp", lift.pickUpId, at.end);
  return out;
}
