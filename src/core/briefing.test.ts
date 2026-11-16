import { describe, expect, it } from "vitest";
import {
  briefingCandidates,
  briefingSentences,
  countdown,
  editionAt,
  forAccount,
  forEdition,
  forPerson,
  logistics,
  publicOnly,
  weekOf,
  type BriefingInput,
} from "./briefing";

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

  it("leaves out Public Holidays more than two weeks away", () => {
    const candidates = briefingCandidates(
      input({
        holidays: new Map([
          ["2026-10-15", ["Soon"]],
          ["2026-10-16", ["Too far"]],
        ]),
      }),
    );
    expect(candidates.map((c) => c.title)).toEqual(["Soon"]);
  });

  it("never includes Private items in a public Briefing, done Tasks or notes", () => {
    const all = briefingCandidates(
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
    const candidates = publicOnly(all);
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

describe("preparation", () => {
  it("says which coming Entry a Task or list prepares for, and dates a list without a period by it", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({
            id: "trip",
            title: "Trip to Porto",
            time: { allDay: true, startDate: "2026-10-09", endDate: "2026-10-11" },
          }),
          entry({ id: "secret", title: "Surprise", private: true }),
        ],
        checklists: [
          { id: "c1", name: "Pack", startDate: null, endDate: null, entryId: "trip" },
          { id: "c2", name: "Unlinked", startDate: null, endDate: null },
        ],
        tasks: [
          task({ id: "t1", title: "Book the hotel", dueDate: "2026-10-05", entryId: "trip" }),
          task({ id: "t2", title: "Buy a gift", dueDate: "2026-10-04", entryId: "secret" }),
          task({ id: "i1", checklistId: "c1" }),
          task({ id: "i2", checklistId: "c2" }),
        ],
      }),
    );
    expect(candidates.find((c) => c.title === "Book the hotel")?.prepares).toBe("Trip to Porto");
    expect(candidates.find((c) => c.title === "Pack")).toMatchObject({
      date: "2026-10-09",
      detail: "0/1",
      prepares: "Trip to Porto",
    });
    // A Private Entry is never named; a list with no period and no Entry has no date.
    expect(candidates.find((c) => c.title === "Buy a gift")?.prepares).toBeUndefined();
    expect(candidates.find((c) => c.title === "Unlinked")).toBeUndefined();
    expect(countdown(candidates, TODAY, "en").map((s) => s.text)).toContain(
      'Book the hotel for "Trip to Porto" · in 3 days (Mon 5 Oct)',
    );
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

  it("gives an Account its Person's Briefing plus the Private items it sees in full", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({ id: "mine", title: "Therapy", private: true, createdBy: "a1", personIds: [] }),
          entry({
            id: "forMe",
            title: "Doctor",
            private: true,
            createdBy: "a2",
            personIds: ["p1"],
          }),
          entry({ id: "theirs", title: "Gift", private: true, createdBy: "a2", personIds: [] }),
          entry({ id: "bia", title: "Bia's party", personIds: ["p2"] }),
        ],
        tasks: [task({ title: "Secret task", private: true, createdBy: "a1" })],
      }),
    );
    const titles = (list: typeof candidates) => list.map((c) => c.title).sort();
    expect(titles(forAccount(candidates, { id: "a1", personId: "p1" }))).toEqual([
      "Doctor",
      "Secret task",
      "Therapy",
    ]);
    // Without a Person: everything public, plus their own Private items.
    expect(titles(forAccount(candidates, { id: "a2", personId: null }))).toEqual([
      "Bia's party",
      "Doctor",
      "Gift",
    ]);
    expect(titles(forPerson(candidates, "p1"))).toEqual([]);
    expect(titles(publicOnly(candidates))).toEqual(["Bia's party"]);
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

describe("briefingSentences", () => {
  it("splits the Briefing into sentences and paragraphs, to be read one at a time", () => {
    expect(
      briefingSentences(
        [
          { text: "Hoje é segunda-feira! Às 09:30 há o " },
          { text: "dentista", link: { kind: "entry", id: "e1", date: "2026-10-26" } },
          { text: ".\n\nTenham um bom dia." },
        ],
        false,
      ),
    ).toEqual(["Hoje é segunda-feira!", "Às 09:30 há o dentista.", "Tenham um bom dia."]);
  });

  it("reads the countdown list line by line, without the dots between", () => {
    expect(
      briefingSentences(
        [
          { text: "Dentist · tomorrow (Tue 27 Oct)" },
          { text: "Book the vet · in 3 days (Thu 29 Oct)" },
        ],
        true,
      ),
    ).toEqual(["Dentist, tomorrow (Tue 27 Oct)", "Book the vet, in 3 days (Thu 29 Oct)"]);
  });
});

describe("editions", () => {
  it("turns to the evening edition at 19:00", () => {
    expect(editionAt(18 * 60 + 59)).toBe("morning");
    expect(editionAt(19 * 60)).toBe("evening");
  });

  it("leaves today's Entries out of the evening edition, not today's Tasks", () => {
    const candidates = briefingCandidates(
      input({
        entries: [
          entry({ time: { allDay: true, startDate: TODAY, endDate: TODAY } }),
          entry({ id: "e2", title: "Swimming" }),
        ],
        tasks: [task({ dueDate: TODAY })],
      }),
    );
    expect(forEdition(candidates, TODAY, "morning")).toHaveLength(3);
    expect(forEdition(candidates, TODAY, "evening").map((c) => c.title)).toEqual([
      "Pay the school",
      "Swimming",
    ]);
  });
});

describe("logistics", () => {
  const at = (id: string, personIds: string[], start: string, end: string, date = "2026-10-05") =>
    entry({
      id,
      title: id,
      personIds,
      time: { allDay: false, startDate: date, startTime: start, endDate: date, endTime: end },
    });
  const names = new Map([
    ["mum", "Mãe"],
    ["dad", "Pai"],
    ["kid", "Bia"],
  ]);
  const adults = new Set(["mum", "dad"]);

  it("finds a Person's clash and a child with no adult free", () => {
    const candidates = briefingCandidates(
      input({
        personNames: names,
        entries: [
          at("Meeting", ["mum"], "17:00", "18:30"),
          at("Gym", ["dad"], "17:30", "18:30"),
          at("Swimming", ["kid"], "18:00", "19:00"),
          at("Dentist", ["dad"], "18:00", "18:45"),
          at("Football", ["kid"], "20:00", "21:00"),
        ],
      }),
    );
    const found = logistics(candidates, TODAY, adults);
    expect(found.clashes).toEqual([
      { person: "Pai", date: "2026-10-05", first: "Gym", second: "Dentist", time: "18:00" },
    ]);
    expect(found.unaccompanied).toEqual([
      { title: "Swimming", persons: ["Bia"], date: "2026-10-05", time: "18:00" },
    ]);
    expect(found.fullDays).toEqual([{ date: "2026-10-05", entries: 5 }]);
    expect(found.fullWeek).toBe(false);
  });

  it("finds nothing when the times don't meet, and a full week by its full days", () => {
    const quiet = briefingCandidates(
      input({
        personNames: names,
        entries: [at("Meeting", ["mum"], "09:00", "10:00"), at("Gym", ["mum"], "10:00", "11:00")],
      }),
    );
    expect(logistics(quiet, TODAY, adults)).toEqual({
      clashes: [],
      unaccompanied: [],
      fullDays: [],
      fullWeek: false,
    });
    const busy = briefingCandidates(
      input({
        entries: ["2026-10-03", "2026-10-04", "2026-10-05"].flatMap((date) =>
          [9, 10, 11, 12, 13].map((h) => at(`${date}-${h}`, [], `${h}:00`, `${h}:30`, date)),
        ),
      }),
    );
    expect(logistics(busy, TODAY, adults).fullWeek).toBe(true);
  });
});
