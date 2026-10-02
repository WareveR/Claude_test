import { describe, expect, it } from "vitest";
import type { Repetition } from "./repetition";
import { familyNow, groupTasks, isOverdue, nextRepeat, periodTasks, type TaskTiming } from "./task";

const task = (fields: Partial<TaskTiming> & { id?: string }) => ({
  dueDate: null,
  dueTime: null,
  doneAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...fields,
});

const now = { today: "2026-10-08", minutes: 15 * 60 };

describe("isOverdue", () => {
  it("is overdue once the due day has ended", () => {
    expect(isOverdue(task({ dueDate: "2026-10-07" }), now)).toBe(true);
    expect(isOverdue(task({ dueDate: "2026-10-08" }), now)).toBe(false);
  });

  it("is overdue once the due time has passed", () => {
    expect(isOverdue(task({ dueDate: "2026-10-08", dueTime: "14:59" }), now)).toBe(true);
    expect(isOverdue(task({ dueDate: "2026-10-08", dueTime: "15:00" }), now)).toBe(false);
    expect(isOverdue(task({ dueDate: "2026-10-09", dueTime: "08:00" }), now)).toBe(false);
  });

  it("is never overdue when done or without a date", () => {
    expect(isOverdue(task({ dueDate: "2026-10-01", doneAt: "2026-10-02T09:00Z" }), now)).toBe(
      false,
    );
    expect(isOverdue(task({}), now)).toBe(false);
  });

  it("uses the Family Time Zone's wall clock", () => {
    // 23:30 UTC on 7 October is already 8 October at 00:30 in Lisbon (summer time).
    const lisbon = familyNow("Europe/Lisbon", new Date("2026-10-07T23:30:00Z"));
    expect(lisbon).toEqual({ today: "2026-10-08", minutes: 30 });
    expect(isOverdue(task({ dueDate: "2026-10-07" }), lisbon)).toBe(true);
    const newYork = familyNow("America/New_York", new Date("2026-10-07T23:30:00Z"));
    expect(isOverdue(task({ dueDate: "2026-10-07" }), newYork)).toBe(false);
  });
});

describe("groupTasks", () => {
  it("sorts Tasks into Overdue, Today, Upcoming, No date and done", () => {
    const tasks = [
      task({ id: "later", dueDate: "2026-10-20" }),
      task({ id: "soon", dueDate: "2026-10-09" }),
      task({ id: "late", dueDate: "2026-10-01" }),
      task({ id: "today-timed", dueDate: "2026-10-08", dueTime: "18:00" }),
      task({ id: "today", dueDate: "2026-10-08" }),
      task({ id: "old-undated", createdAt: "2026-09-01T00:00:00Z" }),
      task({ id: "new-undated", createdAt: "2026-10-05T00:00:00Z" }),
      task({ id: "done-first", doneAt: "2026-10-02T08:00:00Z" }),
      task({ id: "done-last", doneAt: "2026-10-07T08:00:00Z" }),
    ];
    const ids = (list: { id?: string }[]) => list.map((t) => t.id);
    const groups = groupTasks(tasks, now);
    expect(ids(groups.overdue)).toEqual(["late"]);
    expect(ids(groups.today)).toEqual(["today", "today-timed"]);
    expect(ids(groups.upcoming)).toEqual(["soon", "later"]);
    expect(ids(groups.noDate)).toEqual(["new-undated", "old-undated"]);
    expect(ids(groups.done)).toEqual(["done-last", "done-first"]);
  });
});

describe("nextRepeat", () => {
  const weekly: Repetition = { frequency: "weekly", interval: 1, end: { type: "never" } };

  it("is the first Repetition date after today for an overdue Task", () => {
    // Due Monday 28 September, ticked on Thursday 8 October: next is Monday 12 October.
    expect(nextRepeat("2026-09-28", weekly, "2026-10-08")).toEqual({
      dueDate: "2026-10-12",
      repetition: weekly,
    });
  });

  it("skips today itself when the Task is due today", () => {
    expect(nextRepeat("2026-10-08", weekly, "2026-10-08")?.dueDate).toBe("2026-10-15");
  });

  it("follows the Task's own date when it is ticked early", () => {
    expect(nextRepeat("2026-10-20", weekly, "2026-10-08")?.dueDate).toBe("2026-10-27");
  });

  it("keeps the last-day-of-month rule", () => {
    const monthly: Repetition = { frequency: "monthly", interval: 1, end: { type: "never" } };
    expect(nextRepeat("2026-01-31", monthly, "2026-02-01")?.dueDate).toBe("2026-02-28");
  });

  it("carries on with the times left, then ends", () => {
    const thrice: Repetition = { ...weekly, end: { type: "count", count: 3 } };
    const second = nextRepeat("2026-09-28", thrice, "2026-10-01")!;
    expect(second).toEqual({
      dueDate: "2026-10-05",
      repetition: { ...weekly, end: { type: "count", count: 2 } },
    });
    // Ticked late: the missed week counts as one of the times.
    expect(nextRepeat("2026-10-05", second.repetition, "2026-10-13")).toBeNull();
  });

  it("ends after the until date", () => {
    const until: Repetition = { ...weekly, end: { type: "until", date: "2026-10-10" } };
    expect(nextRepeat("2026-10-05", until, "2026-10-05")).toBeNull();
  });
});

describe("periodTasks", () => {
  const tasks = [
    task({ id: "late", dueDate: "2026-09-30" }),
    task({ id: "done-in-week", dueDate: "2026-10-06", doneAt: "2026-10-06T09:00:00Z" }),
    task({ id: "in-week", dueDate: "2026-10-10" }),
    task({ id: "next-week", dueDate: "2026-10-13" }),
    task({ id: "undated" }),
  ];
  const ids = (list: { id?: string }[]) => list.map((t) => t.id);

  it("holds the period's Tasks and every overdue one when the period includes today", () => {
    expect(ids(periodTasks(tasks, "2026-10-05", "2026-10-11", now))).toEqual([
      "late",
      "done-in-week",
      "in-week",
    ]);
  });

  it("leaves overdue Tasks out of other periods", () => {
    expect(ids(periodTasks(tasks, "2026-10-12", "2026-10-18", now))).toEqual(["next-week"]);
  });
});
