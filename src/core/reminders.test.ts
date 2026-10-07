import { describe, expect, it } from "vitest";
import {
  addMinutes,
  checklistReminders,
  entryReminders,
  reminderText,
  remindsDevice,
  taskReminders,
} from "./reminders";

const entry = (patch: Partial<Parameters<typeof entryReminders>[0][number]> = {}) => ({
  id: "e1",
  title: "Dentist",
  time: {
    allDay: false as const,
    startDate: "2026-10-05",
    startTime: "00:30",
    endDate: null,
    endTime: null,
  },
  private: false,
  personIds: [],
  repetition: null,
  reminders: [60],
  exceptions: [],
  ...patch,
});

describe("entryReminders", () => {
  it("fires offsets before the start, across midnight, inside the window only", () => {
    expect(addMinutes("2026-10-05T00:30", -60)).toBe("2026-10-04T23:30");
    expect(entryReminders([entry()], "2026-10-04T23:25", "2026-10-04T23:30")).toMatchObject([
      { key: "entry:e1:2026-10-05:60", at: "2026-10-04T23:30", time: "00:30" },
    ]);
    expect(entryReminders([entry()], "2026-10-04T23:30", "2026-10-04T23:35")).toEqual([]);
  });

  it("reminds All-day Entries from 09:00 and each Occurrence on its own", () => {
    const weekly = entry({
      time: { allDay: true, startDate: "2026-09-07", endDate: "2026-09-07" },
      repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
      reminders: [3 * 1440, 0],
      exceptions: [
        { date: "2026-10-12", skipped: false, override: { private: true } },
        { date: "2026-10-19", skipped: true, override: null },
      ],
    });
    const due = entryReminders([weekly], "2026-10-09T08:55", "2026-10-09T09:00");
    expect(due).toMatchObject([{ date: "2026-10-12", at: "2026-10-09T09:00", private: true }]);
    expect(entryReminders([weekly], "2026-10-16T08:55", "2026-10-16T09:00")).toEqual([]);
    expect(entryReminders([weekly], "2026-10-05T08:55", "2026-10-05T09:00")).toMatchObject([
      { date: "2026-10-05", time: null },
    ]);
  });
});

describe("reminderText and remindsDevice", () => {
  const [due] = entryReminders([entry()], "2026-10-04T23:25", "2026-10-04T23:30");

  it("shows title and time, the date when not today, and hides Private titles", () => {
    expect(reminderText(due, "2026-10-05", "en")).toBe("Dentist, 00:30");
    expect(reminderText(due, "2026-10-04", "en")).toBe("Dentist, Mon 5 Oct 00:30");
    expect(reminderText({ ...due, private: true }, "2026-10-05", "pt-PT")).toBe(
      "Lembrete às 00:30",
    );
    expect(reminderText({ ...due, private: true, time: null }, "2026-10-05", "en")).toBe(
      "Reminder for 5 Oct",
    );
  });

  it("goes to devices with Reminders on whose Persons match; Family-wide goes to all", () => {
    expect(remindsDevice({ remindersOn: false, reminderPersonIds: null }, [])).toBe(false);
    expect(remindsDevice({ remindersOn: true, reminderPersonIds: ["p2"] }, [])).toBe(true);
    expect(remindsDevice({ remindersOn: true, reminderPersonIds: ["p2"] }, ["p1"])).toBe(false);
    expect(remindsDevice({ remindersOn: true, reminderPersonIds: null }, ["p1"])).toBe(true);
  });
});

describe("taskReminders and checklistReminders", () => {
  const task = {
    id: "t1",
    title: "Pay the school",
    dueDate: "2026-10-05",
    dueTime: null,
    doneAt: null,
    private: false,
    personIds: ["p1"],
    checklistId: null,
  };

  it("reminds a dated Task once, at its due time or 09:00; a changed time reminds again", () => {
    expect(taskReminders([task], "2026-10-05T08:55", "2026-10-05T09:00")).toMatchObject([
      { key: "task:t1:2026-10-05T09:00", kind: "task", time: null },
    ]);
    const moved = { ...task, dueTime: "18:30" };
    expect(taskReminders([moved], "2026-10-05T18:25", "2026-10-05T18:30")[0].key).toBe(
      "task:t1:2026-10-05T18:30",
    );
    expect(
      taskReminders([{ ...task, doneAt: "x" }], "2026-10-05T08:55", "2026-10-05T09:00"),
    ).toEqual([]);
    expect(
      taskReminders([{ ...task, dueDate: null }], "2026-10-05T08:55", "2026-10-05T09:00"),
    ).toEqual([]);
  });

  it("never reminds a Checklist's item on its own, whatever its stored date", () => {
    expect(
      taskReminders([{ ...task, checklistId: "c1" }], "2026-10-05T08:55", "2026-10-05T09:00"),
    ).toEqual([]);
  });

  it("reminds a Checklist at 09:00 on its first day when switched on, for its Tasks' Persons", () => {
    const checklist = { id: "c1", name: "School", startDate: "2026-10-05", remindAtStart: true };
    const tasks = [{ ...task, checklistId: "c1" }];
    expect(
      checklistReminders([checklist], tasks, "2026-10-05T08:55", "2026-10-05T09:00"),
    ).toMatchObject([{ key: "checklist:c1:2026-10-05", personIds: ["p1"] }]);
    expect(
      checklistReminders(
        [{ ...checklist, remindAtStart: false }],
        tasks,
        "2026-10-05T08:55",
        "2026-10-05T09:00",
      ),
    ).toEqual([]);
  });
});
