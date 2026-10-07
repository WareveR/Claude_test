import { describe, expect, it } from "vitest";
import type { Repetition } from "./repetition";
import {
  dueRoundStart,
  roundLabel,
  shiftRound,
  checklistGroup,
  checklistProgress,
  checklistSpans,
  checklistTaskTiming,
  firstRoundStart,
  isChecklistTaskOverdue,
  isPending,
  nextRoundStart,
  roundEnd,
} from "./checklist";

const now = { today: "2026-07-15", minutes: 12 * 60 };
const summer = { startDate: "2026-07-01", endDate: "2026-07-31" };
const task = (fields: { dueDate?: string; doneAt?: string }) => ({
  dueDate: fields.dueDate ?? null,
  dueTime: null,
  doneAt: fields.doneAt ?? null,
  createdAt: "2026-06-01T00:00:00Z",
});

describe("Checklists", () => {
  it("counts progress", () => {
    expect(checklistProgress([task({ doneAt: "x" }), task({}), task({})])).toEqual({
      done: 1,
      total: 3,
    });
  });

  it("isn't pending before its start", () => {
    expect(isPending(summer, { ...now, today: "2026-06-30" })).toBe(false);
    expect(isPending(summer, now)).toBe(true);
    expect(isPending({ startDate: null, endDate: null }, now)).toBe(true);
  });

  it("gives its items the end of its round as their due date, ignoring their own", () => {
    expect(checklistTaskTiming(task({}), summer).dueDate).toBe("2026-07-31");
    expect(checklistTaskTiming(task({ dueDate: "2026-07-10" }), summer).dueDate).toBe("2026-07-31");
    expect(
      checklistTaskTiming(task({ dueDate: "2026-07-10" }), { ...summer, endDate: null }),
    ).toMatchObject({ dueDate: null });
  });

  it("ends a repeating round without an end on its start day", () => {
    const weekly = { frequency: "weekly", interval: 1, end: { type: "never" } } as const;
    expect(roundEnd(summer)).toBe("2026-07-31");
    expect(roundEnd({ startDate: "2026-07-05", endDate: null, repetition: weekly })).toBe(
      "2026-07-05",
    );
    expect(roundEnd({ startDate: "2026-07-05", endDate: null })).toBeNull();
    expect(roundEnd({ startDate: null, endDate: "2026-07-05" })).toBe("2026-07-05");
  });

  it("makes undone items overdue at its end, never before its start", () => {
    const after = { ...now, today: "2026-08-01" };
    expect(isChecklistTaskOverdue(task({}), summer, after)).toBe(true);
    expect(isChecklistTaskOverdue(task({ doneAt: "x" }), summer, after)).toBe(false);
    expect(isChecklistTaskOverdue(task({}), summer, now)).toBe(false);
    // An item's own old date no longer makes it overdue.
    expect(isChecklistTaskOverdue(task({ dueDate: "2026-07-10" }), summer, now)).toBe(false);
    const before = { ...now, today: "2026-06-20" };
    expect(isChecklistTaskOverdue(task({}), { ...summer, endDate: "2026-06-10" }, before)).toBe(
      false,
    );
  });

  it("sits in the Tasks view group of its end", () => {
    expect(checklistGroup(summer, [task({})], now)).toBe("upcoming");
    expect(checklistGroup(summer, [task({})], { ...now, today: "2026-07-31" })).toBe("today");
    expect(checklistGroup(summer, [task({})], { ...now, today: "2026-08-02" })).toBe("overdue");
    expect(checklistGroup({ startDate: null, endDate: null }, [task({})], now)).toBe("noDate");
    expect(checklistGroup({ startDate: null, endDate: "2026-07-20" }, [task({})], now)).toBe(
      "upcoming",
    );
    expect(checklistGroup({ startDate: "2026-07-20", endDate: null }, [task({})], now)).toBe(
      "upcoming",
    );
    expect(checklistGroup(summer, [task({ doneAt: "x" })], now)).toBe("done");
  });
});

describe("Checklist rounds", () => {
  const yearly = { frequency: "yearly", interval: 1, end: { type: "never" } } as const;
  const repeating = { ...summer, repetition: yearly };

  it("starts a new round on the next Repetition date, not before", () => {
    expect(dueRoundStart(repeating, "2026-12-31")).toBeNull();
    expect(dueRoundStart(repeating, "2027-07-01")).toBe("2027-07-01");
    // Several missed rounds: only the latest one starts.
    expect(dueRoundStart(repeating, "2029-08-15")).toBe("2029-07-01");
    expect(dueRoundStart({ ...summer, repetition: null }, "2027-07-01")).toBeNull();
  });

  it("shifts the period, keeping its length", () => {
    expect(shiftRound(summer, "2027-07-01")).toEqual({
      startDate: "2027-07-01",
      endDate: "2027-07-31",
      days: 365,
    });
    expect(shiftRound({ startDate: "2026-07-05", endDate: null }, "2026-07-12")).toEqual({
      startDate: "2026-07-12",
      endDate: null,
      days: 7,
    });
    expect(shiftRound({ startDate: null, endDate: null }, null)).toEqual({
      startDate: null,
      endDate: null,
      days: 0,
    });
  });

  it("labels a closed round with its year", () => {
    expect(roundLabel(summer, "2026-08-02")).toBe("2026");
    expect(roundLabel({ startDate: null, endDate: null }, "2027-01-05")).toBe("2027");
  });

  it("finds the first and the next round", () => {
    const sundays: Repetition = {
      frequency: "weekly",
      interval: 1,
      weekdays: [6],
      end: { type: "never" },
    };
    // 2026-07-15 is a Wednesday.
    expect(firstRoundStart(sundays, "2026-07-15")).toBe("2026-07-19");
    expect(firstRoundStart(sundays, "2026-07-19")).toBe("2026-07-19");
    expect(nextRoundStart({ ...summer, repetition: sundays })).toBe("2026-07-05");
    expect(nextRoundStart(summer)).toBeNull();
  });
});

describe("Checklist calendar bars", () => {
  const sundays: Repetition = {
    frequency: "weekly",
    interval: 1,
    weekdays: [6],
    end: { type: "never" },
  };

  it("shows a repeating Checklist only on each round's days", () => {
    const chores = { startDate: "2026-07-05", endDate: null, repetition: sundays };
    expect(checklistSpans(chores, "2026-07-06", "2026-07-19")).toEqual([
      { startDate: "2026-07-12", endDate: "2026-07-12" },
      { startDate: "2026-07-19", endDate: "2026-07-19" },
    ]);
    // With an end, each round keeps that length, and one reaching into the window shows.
    const saturdays = { ...sundays, weekdays: [5] };
    const weekend = { startDate: "2026-07-04", endDate: "2026-07-05", repetition: saturdays };
    expect(checklistSpans(weekend, "2026-07-12", "2026-07-12")).toEqual([
      { startDate: "2026-07-11", endDate: "2026-07-12" },
    ]);
  });

  it("spans start to end, or shows on its only date", () => {
    expect(checklistSpans(summer, "2026-07-20", "2026-08-20")).toEqual([summer]);
    expect(checklistSpans(summer, "2026-08-01", "2026-08-20")).toEqual([]);
    expect(
      checklistSpans({ startDate: null, endDate: "2026-07-20" }, "2026-07-01", "2026-07-31"),
    ).toEqual([{ startDate: "2026-07-20", endDate: "2026-07-20" }]);
    expect(
      checklistSpans({ startDate: "2026-07-20", endDate: null }, "2026-07-01", "2026-07-31"),
    ).toEqual([{ startDate: "2026-07-20", endDate: "2026-07-20" }]);
    expect(checklistSpans({ startDate: null, endDate: null }, "2026-07-01", "2026-07-31")).toEqual(
      [],
    );
  });
});
