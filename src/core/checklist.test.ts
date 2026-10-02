import { describe, expect, it } from "vitest";
import {
  checklistGroup,
  checklistProgress,
  checklistTaskTiming,
  isChecklistTaskOverdue,
  isPending,
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

  it("gives undated Tasks its end as their due date", () => {
    expect(checklistTaskTiming(task({}), summer).dueDate).toBe("2026-07-31");
    expect(checklistTaskTiming(task({ dueDate: "2026-07-10" }), summer).dueDate).toBe("2026-07-10");
  });

  it("makes undone Tasks overdue at its end, never before its start", () => {
    const after = { ...now, today: "2026-08-01" };
    expect(isChecklistTaskOverdue(task({}), summer, after)).toBe(true);
    expect(isChecklistTaskOverdue(task({ doneAt: "x" }), summer, after)).toBe(false);
    expect(isChecklistTaskOverdue(task({}), summer, now)).toBe(false);
    const before = { ...now, today: "2026-06-20" };
    expect(isChecklistTaskOverdue(task({ dueDate: "2026-06-10" }), summer, before)).toBe(false);
  });

  it("sits in the Tasks view group of its end", () => {
    expect(checklistGroup(summer, [task({})], now)).toBe("upcoming");
    expect(checklistGroup(summer, [task({})], { ...now, today: "2026-07-31" })).toBe("today");
    expect(checklistGroup(summer, [task({})], { ...now, today: "2026-08-02" })).toBe("overdue");
    expect(checklistGroup({ startDate: null, endDate: null }, [task({})], now)).toBe("noDate");
    expect(checklistGroup(summer, [task({ doneAt: "x" })], now)).toBe("done");
  });
});
