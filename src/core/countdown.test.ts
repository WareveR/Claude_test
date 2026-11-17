import { describe, expect, it } from "vitest";
import { nextCountdowns } from "./countdown";

const allDay = (startDate: string, endDate = startDate) =>
  ({ allDay: true, startDate, endDate }) as const;

describe("Countdowns", () => {
  const trip = {
    id: "t",
    title: "Férias",
    time: allDay("2026-12-01", "2026-12-07"),
    repetition: null,
    birthYearKnown: false,
  };
  const avo = {
    id: "b",
    title: "Avó Rosa",
    time: allDay("1946-11-20"),
    repetition: { frequency: "yearly" as const, interval: 1, end: { type: "never" as const } },
    birthYearKnown: true,
  };

  it("are the soonest three: marked Entries, Birthdays and Christmas", () => {
    expect(nextCountdowns([trip], [avo], "2026-11-17")).toEqual([
      { kind: "birthday", entryId: "b", title: "Avó Rosa, 80", date: "2026-11-20", days: 3 },
      { kind: "entry", entryId: "t", title: "Férias", date: "2026-12-01", days: 14 },
      { kind: "christmas", entryId: null, title: "", date: "2026-12-25", days: 38 },
    ]);
  });

  it("count an Entry under way as today, and leave out one that is over", () => {
    expect(nextCountdowns([trip], [], "2026-12-03", 1)).toMatchObject([
      { title: "Férias", date: "2026-12-03", days: 0 },
    ]);
    expect(nextCountdowns([trip], [], "2026-12-08").map((c) => c.kind)).toEqual(["christmas"]);
  });

  it("go on to next year's Christmas and Birthday once this year's are past", () => {
    expect(nextCountdowns([], [avo], "2026-12-26")).toEqual([
      { kind: "birthday", entryId: "b", title: "Avó Rosa, 81", date: "2027-11-20", days: 329 },
      { kind: "christmas", entryId: null, title: "", date: "2027-12-25", days: 364 },
    ]);
    expect(nextCountdowns([], [], "2026-12-25")).toMatchObject([{ days: 0 }]);
  });
});
