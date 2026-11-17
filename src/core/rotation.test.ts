import { describe, expect, it } from "vitest";
import { isRotation, nextRotation, turnFor, type Rotation } from "./rotation";

const base: Rotation = {
  personIds: ["ana", "rui", "bia"],
  every: "turn",
  turn: 0,
  anchor: "2026-11-16",
};

describe("Rotation", () => {
  it("goes round one Person per turn", () => {
    let r = base;
    const who: string[] = [];
    for (let i = 0; i < 4; i++) {
      who.push(turnFor(r, "2026-11-20"));
      r = nextRotation(r);
    }
    expect(who).toEqual(["ana", "rui", "bia", "ana"]);
  });

  it("goes round one Person per week, whatever the day", () => {
    const r: Rotation = { ...base, every: "week", turn: 1 };
    expect(turnFor(r, "2026-11-16")).toBe("rui");
    expect(turnFor(r, "2026-11-22")).toBe("rui");
    expect(turnFor(r, "2026-11-23")).toBe("bia");
    expect(turnFor(r, "2026-11-30")).toBe("ana");
    expect(turnFor(r, "2026-11-09")).toBe("ana");
    expect(nextRotation(r)).toBe(r);
  });

  it("needs two Persons or more, each once, and a turn among them", () => {
    expect(isRotation(base)).toBe(true);
    expect(isRotation({ ...base, personIds: ["ana"] })).toBe(false);
    expect(isRotation({ ...base, personIds: ["ana", "ana"] })).toBe(false);
    expect(isRotation({ ...base, turn: 3 })).toBe(false);
    expect(isRotation({ ...base, every: "day" })).toBe(false);
  });
});
