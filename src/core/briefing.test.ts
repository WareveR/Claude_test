import { describe, expect, it } from "vitest";
import { briefingCandidates, countdown, forPerson, weekOf, type BriefingInput } from "./briefing";

const TODAY = "2026-10-02";

const entry = (patch: Partial<BriefingInput["entries"][number]> = {}) => ({
  id: "e1",
  title: "Dentist",
  time: {
    allDay: false as const,
    startDate: "2026-10-05",
    startTime: "15:00",
    endDate: "2026-10-05",
    endTime: "15:30",
  },
  importance: "normal" as const,
  private: false,
  personIds: ["p1"],
  repetition: null,
  exceptions: [],
  ...patch,
});

const task = (patch: Partial<BriefingInput["tasks"][number]> = {}) => ({
  id: "t1",
  title: "Pay the school",
  dueDate: "2026-10-03",
  dueTime: null,
  doneAt: null,
  private: false,
  personIds: [],
  checklistId: null,
  ...patch,
});

const input = (patch: Partial<BriefingInput> = {}): BriefingInput => ({
  today: TODAY,
  entries: [],
  tasks: [],
  checklists: [],
  holidays: new Map(),
  personNames: new Map([["p1", "Ana"]]),
  ...patch,
});

describe("briefingCandidates", () => {
  it("lists what is coming up, overdue first, then by date and importance", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry(),
          entry({
            id: "e2",
            title: "Party",
            importance: "high",
            time: { allDay: true, startDate: "2026-10-05", endDate: "2026-10-05" },
          }),
          entry({
            id: "e3",
            title: "Far away",
            time: { allDay: true, startDate: "2027-01-01", endDate: "2027-01-01" },
          }),
        ],
        tasks: [task(), task({ id: "t2", title: "Renew passport", dueDate: "2026-09-28" })],
        holidays: new Map([["2026-10-05", ["Implantação da República"]]]),
      }),
    );
    expect(candidates.map((c) => c.title)).toEqual([
      "Renew passport",
      "Pay the school",
      "Party",
      "Dentist",
      "Implantação da República",
    ]);
    expect(candidates[0]).toMatchObject({ kind: "task", detail: "overdue", importance: "high" });
    expect(candidates[3]).toMatchObject({ persons: ["Ana"], time: "15:00" });
  });

  it("never includes Private items, done Tasks or notes", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({ private: true }),
          entry({
            id: "e2",
            title: "Swimming",
            repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
            exceptions: [{ date: "2026-10-12", skipped: false, override: { private: true } }],
          }),
        ],
        tasks: [task({ private: true }), task({ id: "t2", doneAt: "2026-10-01T10:00:00Z" })],
      }),
    );
    expect(candidates.map((c) => c.title)).not.toContain("Dentist");
    expect(candidates.filter((c) => c.title === "Swimming").map((c) => c.date)).not.toContain(
      "2026-10-12",
    );
    expect(candidates.some((c) => c.kind === "task")).toBe(false);
    expect(JSON.stringify(candidates)).not.toContain("notes");
  });

  it("gives Birthdays their age and open Checklists their progress", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({
            id: "b1",
            title: "Bia",
            birthdayPersonId: "p2",
            birthYearKnown: true,
            time: { allDay: true, startDate: "2016-10-20", endDate: "2016-10-20" },
            repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
          }),
        ],
        checklists: [
          { id: "c1", name: "Back to school", startDate: "2026-09-01", endDate: "2026-10-10" },
        ],
        tasks: [
          task({ id: "t1", checklistId: "c1", doneAt: "2026-09-02T10:00:00Z" }),
          task({ id: "t2", checklistId: "c1" }),
        ],
      }),
    );
    expect(candidates).toMatchObject([
      { kind: "checklist", title: "Back to school", detail: "1/2", date: "2026-10-10" },
      { kind: "entry", title: "Bia, 10", date: "2026-10-20" },
    ]);
  });

  it("gives a repeating Checklist without an end its round's start day, never its items alone", () => {
    const candidates = briefingCandidates(
      input({
        checklists: [
          {
            id: "c1",
            name: "Sunday chores",
            startDate: TODAY,
            endDate: null,
            repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
          },
        ],
        tasks: [task({ id: "t1", checklistId: "c1", dueDate: TODAY })],
      }),
    );
    expect(candidates).toMatchObject([{ kind: "checklist", date: TODAY, detail: "0/1" }]);
  });
});

describe("countdown", () => {
  it("lists the most pressing candidates with a countdown and date", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({
            title: "Mum's birthday",
            time: { allDay: true, startDate: "2026-10-07", endDate: "2026-10-07" },
          }),
        ],
        tasks: [task(), task({ id: "t2", title: "Renew passport", dueDate: "2026-09-29" })],
      }),
    );
    expect(countdown(candidates, TODAY, "en").map((s) => s.text)).toEqual([
      "Renew passport · 3 days overdue (Tue 29 Sept)",
      "Pay the school · tomorrow (Sat 3 Oct)",
      "Mum's birthday · in 5 days (Wed 7 Oct)",
    ]);
    expect(countdown(candidates, TODAY, "en")[2].link).toEqual({
      kind: "entry",
      id: "e1",
      date: "2026-10-07",
    });
    expect(countdown([], TODAY, "pt-PT")).toEqual([
      { text: "Nada marcado para os próximos dias." },
    ]);
  });
});

describe("forPerson and weekOf", () => {
  it("gives a Person what is theirs and Family-wide; a Checklist when any Task is", () => {
    const candidates = briefingCandidates(
      input({
        entries: [entry(), entry({ id: "e2", title: "Bia's party", personIds: ["p2"] })],
        tasks: [
          task({ personIds: [] }),
          task({ id: "t2", checklistId: "c1", personIds: ["p2"] }),
          task({ id: "t3", checklistId: "c1", personIds: ["p1"] }),
        ],
        checklists: [{ id: "c1", name: "School", startDate: null, endDate: "2026-10-04" }],
      }),
    );
    expect(forPerson(candidates, "p1").map((c) => c.title)).toEqual([
      "Pay the school",
      "School",
      "Dentist",
    ]);
    expect(forPerson(candidates, "p3").map((c) => c.title)).toEqual(["Pay the school"]);
  });

  it("changes only when the next 7 days do", () => {
    const week = (date: string) =>
      weekOf(
        briefingCandidates(input({ tasks: [task(), task({ id: "t2", dueDate: date })] })),
        TODAY,
      );
    expect(week("2026-11-20")).toBe(week("2026-12-01"));
    expect(week("2026-10-08")).not.toBe(week("2026-11-20"));
  });
});
