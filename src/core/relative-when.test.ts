import { describe, expect, it } from "vitest";
import { relativeWhen } from "./relative-when";

const now = { today: "2026-10-12", minutes: 15 * 60 } as const;
const at = (date: string, time: string | null) => ({ date, time }) as never;
const say = (start: [string, string | null], end: [string, string | null], locale = "pt-PT") =>
  relativeWhen(at(...start), at(...end), now, locale);

describe("relativeWhen", () => {
  it("counts days, with the time alongside", () => {
    expect(say(["2026-10-15", "17:00"], ["2026-10-15", "18:00"])).toEqual({
      kind: "relative",
      text: "dentro de 3 dias",
      time: "17:00",
    });
    expect(say(["2026-10-13", null], ["2026-10-13", null])).toMatchObject({ text: "amanhã" });
    expect(say(["2026-10-13", "09:00"], ["2026-10-13", null], "en-GB")).toMatchObject({
      text: "tomorrow",
      time: "09:00",
    });
  });

  it("counts hours or minutes later today", () => {
    expect(say(["2026-10-12", "17:00"], ["2026-10-12", "18:00"])).toEqual({
      kind: "relative",
      text: "dentro de 2 horas",
      time: null,
    });
    expect(say(["2026-10-12", "15:40"], ["2026-10-12", "16:00"])).toMatchObject({
      text: "dentro de 40 minutos",
    });
  });

  it("knows when it is happening now", () => {
    expect(say(["2026-10-12", "14:00"], ["2026-10-12", "16:00"])).toEqual({ kind: "now" });
    expect(say(["2026-10-10", null], ["2026-10-14", null])).toEqual({ kind: "now" });
  });

  it("counts weeks and months further away, and the past", () => {
    expect(say(["2026-11-02", "10:00"], ["2026-11-02", null])).toMatchObject({
      text: "dentro de 3 semanas",
      time: null,
    });
    expect(say(["2027-01-12", null], ["2027-01-12", null])).toMatchObject({
      text: "dentro de 3 meses",
    });
    expect(say(["2026-10-09", "10:00"], ["2026-10-09", "11:00"])).toMatchObject({
      text: "há 3 dias",
    });
  });
});
