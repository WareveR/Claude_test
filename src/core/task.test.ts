import { describe, expect, it } from "vitest";
import { familyNow, groupTasks, isOverdue, type TaskTiming } from "./task";

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
