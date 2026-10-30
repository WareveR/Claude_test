import { describe, expect, it } from "vitest";
import { agendaAnswer, questionDays, whenAnswer } from "./voice-question";

const names = (ids: string[]) => ids.map((id) => ({ ana: "Ana", rui: "Rui" })[id] ?? "");
const timed = (date: string, start: string, end: string) => ({
  allDay: false as const,
  startDate: date,
  startTime: start,
  endDate: date,
  endTime: end,
});
const entry = (title: string, time: ReturnType<typeof timed>, personIds: string[] = []) => ({
  title,
  time,
  personIds,
  repetition: null,
  exceptions: [],
  hidden: false,
});
const day = { from: "2026-10-09", to: "2026-10-09", startTime: null, endTime: null };

describe("agendaAnswer", () => {
  it("says a day's Entries by time, with whose they are, and the Tasks due", () => {
    const text = agendaAnswer(
      { ...day, personIds: null },
      [
        entry("Jantar", timed("2026-10-09", "20:00", "22:00")),
        entry("Dentista", timed("2026-10-09", "10:00", "11:00"), ["ana"]),
      ],
      [
        {
          title: "Pagar a água",
          dueDate: "2026-10-09",
          dueTime: null,
          doneAt: null,
          personIds: [],
          hidden: false,
        },
      ],
      names,
      "pt-PT",
    );
    expect(text).toBe(
      "sexta-feira, 9 de outubro: 10:00 Dentista (Ana); 20:00 Jantar. Tarefas: Pagar a água.",
    );
  });

  it("keeps to the part of the day and the Persons asked about, and hides what is Private", () => {
    const entries = [
      entry("Ginásio", timed("2026-10-09", "09:00", "10:00"), ["rui"]),
      { ...entry("Médico", timed("2026-10-09", "15:00", "16:00"), ["rui"]), hidden: true },
      entry("Natação", timed("2026-10-09", "18:00", "19:00"), ["ana"]),
    ];
    expect(
      agendaAnswer(
        { ...day, startTime: "12:00", endTime: "19:00", personIds: ["rui"] },
        entries,
        [],
        names,
        "pt-PT",
      ),
    ).toBe("sexta-feira, 9 de outubro, entre as 12:00 e as 19:00: 15:00 Privado.");
  });

  it("says nothing on for empty days, once for several", () => {
    expect(agendaAnswer({ ...day, personIds: null }, [], [], names, "en")).toBe(
      "Friday 9 October: nothing on.",
    );
    expect(agendaAnswer({ ...day, to: "2026-10-11", personIds: null }, [], [], names, "en")).toBe(
      "Friday 9 October – Sunday 11 October: nothing on.",
    );
  });
});

describe("questionDays", () => {
  it("is today by default, one day without an end, and two weeks at most", () => {
    expect(questionDays(null, null, "2026-10-06")).toEqual({
      from: "2026-10-06",
      to: "2026-10-06",
    });
    expect(questionDays("2026-10-09", "2026-10-01", "2026-10-06")).toEqual({
      from: "2026-10-09",
      to: "2026-10-09",
    });
    expect(questionDays("2026-10-01", "2026-12-31", "2026-10-06").to).toBe("2026-10-14");
  });
});

describe("whenAnswer", () => {
  it("says when one item is, and for whom", () => {
    expect(
      whenAnswer(
        { title: "Dentista", date: "2026-10-09", time: "10:00", personIds: ["ana"] },
        names,
        "pt-PT",
      ),
    ).toBe("Dentista (Ana): sexta-feira, 9 de outubro, 10:00.");
  });
});
