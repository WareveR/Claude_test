import { describe, expect, it } from "vitest";
import { setUpFamily, type TestBrowser } from "./test/client";

type Entry = {
  id: string;
  title: string;
  entryTypeId: string;
  time: { allDay: boolean; startDate: string; endDate: string };
  personIds: string[];
  repetition: unknown;
  reminders: number[];
  notes: string;
  birthdayPersonId: string | null;
  birthYearKnown: boolean;
};

async function birthdays(browser: TestBrowser) {
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  const birthday = types.find((t) => t.builtinKey === "birthday")!.id;
  return (await (await browser.get(`/entries?entryTypeId=${birthday}`)).json()) as Entry[];
}

async function withAna(dateOfBirth: string | null = "1990-05-17") {
  const browser = await setUpFamily();
  const ana = (await (
    await browser.post("/persons", { name: "Ana", color: "#e07a5f", dateOfBirth })
  ).json()) as { id: string };
  return { browser, ana };
}

const patch = (browser: TestBrowser, id: string, body: unknown) =>
  browser.request("PATCH", `/persons/${id}`, body);

describe("synced Birthdays", () => {
  it("creates a yearly all-day Birthday Entry from a date of birth", async () => {
    const { browser, ana } = await withAna();
    const [entry] = await birthdays(browser);
    expect(entry).toMatchObject({
      title: "Ana",
      time: { allDay: true, startDate: "1990-05-17", endDate: "1990-05-17" },
      personIds: [ana.id],
      repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      reminders: [4320, 0],
      birthdayPersonId: ana.id,
      birthYearKnown: true,
    });
  });

  it("moves, renames and removes the Birthday with the Person", async () => {
    const { browser, ana } = await withAna(null);
    expect(await birthdays(browser)).toHaveLength(0);
    await patch(browser, ana.id, { dateOfBirth: "1990-05-17" });
    await patch(browser, ana.id, { dateOfBirth: "1991-06-01", name: "Ana Pires" });
    let all = await birthdays(browser);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ title: "Ana Pires", time: { startDate: "1991-06-01" } });
    await patch(browser, ana.id, { dateOfBirth: null });
    all = await birthdays(browser);
    expect(all).toHaveLength(0);
  });

  it("keeps notes, Importance and Reminders edited on the Entry", async () => {
    const { browser, ana } = await withAna();
    const [entry] = await birthdays(browser);
    const res = await browser.request("PUT", `/entries/${entry.id}`, {
      ...entry,
      notes: "Loves chocolate",
      importance: "high",
      reminders: [0],
    });
    expect(res.status).toBe(200);
    await patch(browser, ana.id, { dateOfBirth: "1990-05-18" });
    const [moved] = await birthdays(browser);
    expect(moved).toMatchObject({ notes: "Loves chocolate", reminders: [0] });
  });

  it("locks the date and Person on the Entry and refuses deleting it", async () => {
    const { browser } = await withAna();
    const [entry] = await birthdays(browser);
    const moved = await browser.request("PUT", `/entries/${entry.id}`, {
      ...entry,
      time: { ...entry.time, startDate: "1990-05-20", endDate: "1990-05-20" },
    });
    expect(moved.status).toBe(409);
    expect(await moved.json()).toEqual({ error: "birthday_locked", field: "time" });
    const unlinked = await browser.request("PUT", `/entries/${entry.id}`, {
      ...entry,
      personIds: [],
    });
    expect(unlinked.status).toBe(409);
    expect((await browser.delete(`/entries/${entry.id}`)).status).toBe(409);
    expect((await browser.delete(`/entries/${entry.id}/occurrences/2026-05-17`)).status).toBe(409);
  });

  it("goes with its Person when the Person is deleted", async () => {
    const { browser, ana } = await withAna();
    expect((await browser.delete(`/persons/${ana.id}`)).status).toBe(204);
    expect(await birthdays(browser)).toHaveLength(0);
  });

  it("removes the Birthday when archiving unless asked to keep it", async () => {
    const { browser, ana } = await withAna();
    await patch(browser, ana.id, { archived: true });
    expect(await birthdays(browser)).toHaveLength(0);
    await patch(browser, ana.id, { archived: false });
    expect(await birthdays(browser)).toHaveLength(1);
  });

  it("keeps an archived Person's Birthday Family-wide and hand-editable", async () => {
    const { browser, ana } = await withAna();
    await patch(browser, ana.id, { archived: true, keepBirthday: true });
    const [kept] = await birthdays(browser);
    expect(kept).toMatchObject({ title: "Ana", personIds: [], birthdayPersonId: null });
    const res = await browser.request("PUT", `/entries/${kept.id}`, {
      ...kept,
      title: "Ana (in memory)",
    });
    expect(res.status).toBe(200);
    expect((await browser.delete(`/entries/${kept.id}`)).status).toBe(204);
  });
});

describe("hand-entered Birthdays", () => {
  it("are Family-wide with the birth year optional", async () => {
    const browser = await setUpFamily();
    const types = (await (await browser.get("/entry-types")).json()) as {
      id: string;
      builtinKey: string;
    }[];
    const res = await browser.post("/entries", {
      title: "Grandma Rosa",
      entryTypeId: types.find((t) => t.builtinKey === "birthday")!.id,
      time: { allDay: true, startDate: "1946-03-12", endDate: "1946-03-12" },
      repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      birthYearKnown: true,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      personIds: [],
      birthdayPersonId: null,
      birthYearKnown: true,
    });
  });
});
