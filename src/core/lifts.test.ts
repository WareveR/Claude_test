import { describe, expect, it } from "vitest";
import { liftClashes, liftMissing, parseLift } from "./lifts";

describe("Lifts", () => {
  it("are read with nobody set unless said", () => {
    expect(parseLift({})).toEqual({ lift: { dropOffId: null, pickUpId: null } });
    expect(parseLift({ dropOffId: "rui" })).toEqual({ lift: { dropOffId: "rui", pickUpId: null } });
    expect(parseLift({ pickUpId: 3 })).toEqual({ field: "pickUpId" });
  });

  it("say who is missing", () => {
    expect(liftMissing({ dropOffId: null, pickUpId: null })).toEqual(["dropOff", "pickUp"]);
    expect(liftMissing({ dropOffId: "rui", pickUpId: null })).toEqual(["pickUp"]);
    expect(liftMissing({ dropOffId: "rui", pickUpId: "ana" })).toEqual([]);
  });

  it("find a taker busy at the start and a picker busy at the end", () => {
    const lift = { entryId: "ballet", dropOffId: "rui", pickUpId: "ana" };
    const at = { start: "17:00", end: "18:00" };
    const others = [
      { id: "ballet", title: "Ballet", personIds: ["rui", "ana"], start: "17:00", end: "18:00" },
      { id: "meeting", title: "Reunião", personIds: ["rui"], start: "16:30", end: "17:30" },
      { id: "gym", title: "Ginásio", personIds: ["ana"], start: "18:00", end: "19:00" },
      { id: "lunch", title: "Almoço", personIds: ["ana"], start: "12:00", end: "13:00" },
    ];
    expect(liftClashes(lift, at, others)).toEqual([
      { role: "dropOff", personId: "rui", title: "Reunião" },
      { role: "pickUp", personId: "ana", title: "Ginásio" },
    ]);
    expect(liftClashes(lift, at, others.slice(0, 1))).toEqual([]);
  });
});
