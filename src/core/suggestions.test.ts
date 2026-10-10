import { describe, expect, it } from "vitest";
import {
  draftsFor,
  IDEAS,
  imiDates,
  inspectionDates,
  iucDates,
  parseWritten,
  phrasesOf,
  themeOf,
  type Answers,
} from "./suggestions";

const TODAY = "2026-10-10";
const answers: Answers = { registration: null, iucBand: "upTo100", imiBand: "upTo100", expiry: {} };
const idea = (id: string) => IDEAS.find((i) => i.id === id)!;

describe("iucDates", () => {
  it("pays 2026 in the registration month, 2027 in October, and every April from 2028", () => {
    expect(iucDates("2019-11-03", "upTo100", TODAY)).toEqual([
      { date: "2026-11-30", time: null, repetition: null, year: 2026 },
      { date: "2027-10-31", time: null, repetition: null, year: 2027 },
      {
        date: "2028-04-30",
        time: null,
        repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      },
    ]);
  });

  it("leaves out a 2026 month already gone and splits larger amounts into instalments", () => {
    const dates = iucDates("2019-04-03", "over500", TODAY);
    expect(dates.map((d) => [d.date, d.part?.n ?? null, d.repetition ? "yearly" : "once"])).toEqual(
      [
        ["2027-07-31", 1, "once"],
        ["2027-10-31", 2, "once"],
        ["2028-04-30", 1, "yearly"],
        ["2028-07-31", 2, "yearly"],
        ["2028-10-31", 3, "yearly"],
      ],
    );
    expect(iucDates(null, "upTo500", TODAY).map((d) => d.date)).toEqual([
      "2027-10-31",
      "2028-04-30",
      "2028-10-31",
    ]);
  });
});

describe("inspectionDates", () => {
  it("is due every two years until the car is 8, then every year", () => {
    expect(inspectionDates("2021-03-15", TODAY)).toEqual([
      {
        date: "2027-03-15",
        time: null,
        repetition: {
          frequency: "yearly",
          interval: 2,
          end: { type: "until", date: "2029-03-15" },
        },
      },
      {
        date: "2030-03-15",
        time: null,
        repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      },
    ]);
  });

  it("is due every year for an older car", () => {
    expect(inspectionDates("2012-05-20", TODAY).map((d) => d.date)).toEqual(["2027-05-20"]);
    expect(inspectionDates("2018-12-01", TODAY).map((d) => d.date)).toEqual(["2026-12-01"]);
  });
});

describe("imiDates", () => {
  it("pays in May, May and November, or May, August and November", () => {
    expect(imiDates("upTo100", TODAY).map((d) => d.date)).toEqual(["2027-05-31"]);
    expect(imiDates("upTo500", TODAY).map((d) => d.date)).toEqual(["2027-05-31", "2026-11-30"]);
    expect(imiDates("over500", TODAY).map((d) => d.part)).toEqual([
      { n: 1, of: 3 },
      { n: 2, of: 3 },
      { n: 3, of: 3 },
    ]);
  });
});

describe("draftsFor", () => {
  it("makes a bill paid by hand a Task and one paid by direct debit a notice", () => {
    const [manual] = draftsFor(idea("water"), "manual", answers, TODAY);
    expect(manual).toMatchObject({ kind: "task", date: "2026-10-15" });
    expect(manual.debit).toBeUndefined();
    const [debit] = draftsFor(idea("water"), "debit", answers, TODAY);
    expect(debit).toMatchObject({ kind: "entry", debit: true, date: "2026-10-15" });
  });

  it("starts a monthly bill next month once this month's day has gone", () => {
    expect(draftsFor(idea("internet"), "manual", answers, TODAY)[0].date).toBe("2026-11-05");
  });

  it("puts weekly routines on their next weekday at their time", () => {
    const [gym] = draftsFor(idea("gym"), "manual", answers, TODAY);
    expect(gym).toMatchObject({
      kind: "entry",
      date: "2026-10-12",
      time: "19:00",
      repetition: { frequency: "weekly", weekdays: [0, 2] },
    });
  });

  it("waits for the answers it needs", () => {
    expect(draftsFor(idea("inspection"), "manual", answers, TODAY)).toEqual([]);
    expect(draftsFor(idea("passport"), "manual", answers, TODAY)).toEqual([]);
    const withExpiry = { ...answers, expiry: { passport: "2027-03-20" } };
    expect(draftsFor(idea("passport"), "manual", withExpiry, TODAY)).toMatchObject([
      { date: "2027-02-20", repetition: null },
    ]);
  });

  it("gives each draft its own key", () => {
    const keys = draftsFor(idea("imi"), "manual", { ...answers, imiBand: "over500" }, TODAY).map(
      (d) => d.key,
    );
    expect(new Set(keys).size).toBe(3);
  });
});

describe("themes and phrases", () => {
  it("knows a whole area from one word, with or without an article or accents", () => {
    expect(themeOf("Carro")).toBe("car");
    expect(themeOf("o cão")).toBe("pets");
    expect(themeOf("Saúde")).toBe("health");
    expect(themeOf("ginásio às 19h")).toBeNull();
  });

  it("splits the text on commas and lines", () => {
    expect(phrasesOf("carro, ginásio 2a e 4a às 19h\nregar ao sábado;")).toEqual([
      "carro",
      "ginásio 2a e 4a às 19h",
      "regar ao sábado",
    ]);
  });
});

describe("parseWritten", () => {
  it("keeps good items, drops bad ones and starts weekly ones on their weekday", () => {
    const items = parseWritten(
      {
        items: [
          {
            kind: "entry",
            title: "Ginásio",
            date: null,
            time: "19:00",
            repeat: { frequency: "weekly", interval: 1, weekdays: [0, 2] },
          },
          { kind: "task", title: "", date: null, time: null, repeat: null },
          { kind: "event", title: "x" },
          { kind: "task", title: "Vacinas do bebé", date: "2020-01-01", time: null, repeat: null },
        ],
      },
      TODAY,
    );
    expect(items).toEqual([
      {
        kind: "entry",
        title: "Ginásio",
        date: "2026-10-12",
        time: "19:00",
        repetition: { frequency: "weekly", interval: 1, weekdays: [0, 2], end: { type: "never" } },
      },
      { kind: "task", title: "Vacinas do bebé", date: TODAY, time: null, repetition: null },
    ]);
    expect(parseWritten("nonsense", TODAY)).toBeNull();
  });
});
