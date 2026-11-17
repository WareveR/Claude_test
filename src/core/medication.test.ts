import { describe, expect, it } from "vitest";
import {
  dosesBetween,
  doseReminder,
  dosesOn,
  parseMedication,
  type Medication,
} from "./medication";

const med = (over: Partial<Medication> = {}): Medication => ({
  id: "m",
  personId: "bia",
  name: "Ben-u-ron",
  dose: "5 ml",
  times: ["08:00", "20:00"],
  startDate: "2026-11-17",
  endDate: "2026-11-19",
  private: true,
  notes: "",
  createdBy: null,
  createdAt: "",
  changedAt: "",
  ...over,
});

describe("Medication", () => {
  it("is cleaned and Private unless said", () => {
    const parsed = parseMedication({
      personId: "bia",
      name: " Ben-u-ron ",
      dose: "5 ml",
      times: ["20:00", "08:00", "08:00"],
      startDate: "2026-11-17",
    });
    expect(parsed).toEqual({
      medication: {
        personId: "bia",
        name: "Ben-u-ron",
        dose: "5 ml",
        times: ["08:00", "20:00"],
        startDate: "2026-11-17",
        endDate: null,
        private: true,
        notes: "",
      },
    });
  });

  it("names the bad field", () => {
    const ok = { personId: "b", name: "X", times: ["08:00"], startDate: "2026-11-17" };
    expect(parseMedication({ ...ok, times: [] })).toEqual({ field: "times" });
    expect(parseMedication({ ...ok, times: ["8h"] })).toEqual({ field: "times" });
    expect(parseMedication({ ...ok, endDate: "2026-11-16" })).toEqual({ field: "endDate" });
    expect(parseMedication({ ...ok, name: "" })).toEqual({ field: "name" });
  });

  it("is due on the days of its treatment, at its times", () => {
    expect(dosesOn([med()], "2026-11-16")).toEqual([]);
    expect(dosesOn([med()], "2026-11-19").map((d) => d.time)).toEqual(["08:00", "20:00"]);
    expect(dosesOn([med()], "2026-11-20")).toEqual([]);
    expect(dosesOn([med({ endDate: null })], "2030-01-01")).toHaveLength(2);
  });

  it("finds the doses due in a window, across midnight", () => {
    const due = dosesBetween([med()], "2026-11-17T19:55", "2026-11-18T08:00");
    expect(due.map((d) => `${d.date} ${d.time}`)).toEqual(["2026-11-17 20:00", "2026-11-18 08:00"]);
    expect(dosesBetween([med()], "2026-11-17T08:00", "2026-11-17T08:05")).toEqual([]);
  });

  it("keeps a Private dose's Reminder anonymous", () => {
    const due = { medication: med(), date: "2026-11-17", time: "08:00" } as const;
    expect(doseReminder(due, "Bia", "pt-PT").title).toBe("Medicação às 08:00");
    const open = { ...due, medication: med({ private: false }) };
    expect(doseReminder(open, "Bia", "pt-PT").title).toBe("Ben-u-ron 5 ml · Bia às 08:00");
    expect(doseReminder(open, "Bia", "en")).toEqual({
      title: "Ben-u-ron 5 ml · Bia at 08:00",
      taken: "Taken",
    });
  });
});
