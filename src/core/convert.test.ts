import { describe, expect, it } from "vitest";
import { entryFromTask, taskFromEntry, type EntryToConvert } from "./convert";
import type { Repetition } from "./repetition";

const weekly: Repetition = { frequency: "weekly", interval: 1, end: { type: "never" } };

const entry = (fields: Partial<EntryToConvert>): EntryToConvert => ({
  title: "Dentist",
  notes: "",
  personIds: ["p1"],
  private: true,
  importance: "high",
  repetition: null,
  location: "",
  time: {
    allDay: false,
    startDate: "2026-10-20",
    startTime: "15:00",
    endDate: "2026-10-20",
    endTime: "16:00",
  },
  ...fields,
});

describe("taskFromEntry", () => {
  it("is due at the Entry's start and keeps what both have", () => {
    expect(taskFromEntry(entry({ location: "Rua Augusta" }), "2026-10-12")).toEqual({
      title: "Dentist",
      notes: "Rua Augusta",
      personIds: ["p1"],
      private: true,
      importance: "high",
      repetition: null,
      dueDate: "2026-10-20",
      dueTime: "15:00",
    });
  });

  it("is due all day for an All-day Entry, its location after the notes", () => {
    const task = taskFromEntry(
      entry({
        notes: "Bring the card",
        location: "Clinic",
        time: { allDay: true, startDate: "2026-10-20", endDate: "2026-10-22" },
      }),
      "2026-10-12",
    );
    expect(task).toMatchObject({ dueDate: "2026-10-20", dueTime: null });
    expect(task.notes).toBe("Bring the card\nClinic");
  });

  it("is due on a repeating Entry's next Occurrence from today", () => {
    // Weekly on Mondays since 7 September; today is Monday 12 October.
    const gym = entry({
      repetition: weekly,
      time: { allDay: true, startDate: "2026-09-07", endDate: "2026-09-07" },
    });
    expect(taskFromEntry(gym, "2026-10-12")).toMatchObject({
      dueDate: "2026-10-12",
      repetition: weekly,
    });
    expect(taskFromEntry(gym, "2026-10-13").dueDate).toBe("2026-10-19");
  });

  it("stops repeating once a repeating Entry's Occurrences are over", () => {
    const over = entry({
      repetition: { ...weekly, end: { type: "until", date: "2026-09-30" } },
      time: { allDay: true, startDate: "2026-09-07", endDate: "2026-09-07" },
    });
    expect(taskFromEntry(over, "2026-10-12")).toMatchObject({
      dueDate: "2026-09-07",
      repetition: null,
    });
  });
});

describe("entryFromTask", () => {
  const task = {
    title: "Pay the rent",
    notes: "",
    personIds: [],
    private: false,
    importance: "normal" as const,
    repetition: null,
    dueDate: null,
    dueTime: null,
  };

  it("starts at the due time, or all day on the due date", () => {
    expect(
      entryFromTask({ ...task, dueDate: "2026-10-20", dueTime: "09:30" }, "2026-10-12").time,
    ).toEqual({
      allDay: false,
      startDate: "2026-10-20",
      startTime: "09:30",
      endDate: null,
      endTime: null,
    });
    expect(entryFromTask({ ...task, dueDate: "2026-10-20" }, "2026-10-12").time).toEqual({
      allDay: true,
      startDate: "2026-10-20",
      endDate: "2026-10-20",
    });
  });

  it("is all day today without a due date, and keeps a repeating Task's Repetition", () => {
    expect(entryFromTask(task, "2026-10-12").time).toEqual({
      allDay: true,
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    });
    expect(
      entryFromTask({ ...task, dueDate: "2026-11-01", repetition: weekly }, "2026-10-12"),
    ).toMatchObject({ repetition: weekly, time: { startDate: "2026-11-01" } });
  });
});
