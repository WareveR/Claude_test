import { describe, expect, it } from "vitest";
import { setUpFamily, type TestBrowser } from "../test/client";

type Entry = {
  id: string;
  title: string;
  entryTypeId: string;
  time: Record<string, unknown>;
  personIds: string[];
  importance: string;
  private: boolean;
  reminders: number[];
};

async function typeId(browser: TestBrowser, key: string) {
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  return types.find((t) => t.builtinKey === key)!.id;
}

async function family() {
  const browser = await setUpFamily();
  const ana = (await (
    await browser.post("/persons", { name: "Ana", color: "#e07a5f" })
  ).json()) as { id: string };
  return { browser, ana, appointment: await typeId(browser, "appointment") };
}

const dentist = (entryTypeId: string, personIds: string[]) => ({
  title: "Dentist",
  entryTypeId,
  time: {
    allDay: false,
    startDate: "2026-10-13",
    startTime: "15:00",
    endDate: "2026-10-13",
    endTime: "15:45",
  },
  personIds,
  importance: "high",
  location: "Clínica",
  notes: "Bring the card",
  private: true,
  reminders: [60, 1440],
});

describe("Entries", () => {
  it("creates a Timed Entry with every field", async () => {
    const { browser, ana, appointment } = await family();
    const res = await browser.post("/entries", dentist(appointment, [ana.id]));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      title: "Dentist",
      personIds: [ana.id],
      importance: "high",
      private: true,
      reminders: [1440, 60],
      time: { allDay: false, startTime: "15:00", endTime: "15:45" },
    });
  });

  it("creates an All-day Entry and a Timed Entry without an end", async () => {
    const { browser, appointment } = await family();
    const holiday = await browser.post("/entries", {
      title: "Algarve",
      entryTypeId: await typeId(browser, "holiday"),
      time: { allDay: true, startDate: "2026-08-01", endDate: "2026-08-15" },
    });
    expect(holiday.status).toBe(201);
    const pickUp = await browser.post("/entries", {
      title: "Pick up",
      entryTypeId: appointment,
      time: { allDay: false, startDate: "2026-10-09", startTime: "17:30" },
    });
    expect(await pickUp.json()).toMatchObject({
      personIds: [],
      importance: "normal",
      time: { endDate: null, endTime: null },
    });
  });

  it("refuses an end before the start, unknown types and unknown Persons", async () => {
    const { browser, appointment } = await family();
    const bad = dentist(appointment, []);
    expect(
      (await browser.post("/entries", { ...bad, time: { ...bad.time, endTime: "14:00" } })).status,
    ).toBe(400);
    expect((await browser.post("/entries", { ...bad, entryTypeId: "nope" })).status).toBe(400);
    expect((await browser.post("/entries", { ...bad, personIds: ["ghost"] })).status).toBe(400);
    expect((await browser.post("/entries", { ...bad, title: "" })).status).toBe(400);
  });

  it("lists the Entries overlapping a window", async () => {
    const { browser, appointment } = await family();
    await browser.post("/entries", dentist(appointment, []));
    await browser.post("/entries", {
      title: "Algarve",
      entryTypeId: appointment,
      time: { allDay: true, startDate: "2026-10-01", endDate: "2026-10-05" },
    });
    const week = (await (
      await browser.get("/entries?from=2026-10-05&to=2026-10-11")
    ).json()) as Entry[];
    expect(week.map((e) => e.title)).toEqual(["Algarve"]);
    const next = (await (
      await browser.get("/entries?from=2026-10-12&to=2026-10-18")
    ).json()) as Entry[];
    expect(next.map((e) => e.title)).toEqual(["Dentist"]);
  });

  it("changes the type and keeps the other values", async () => {
    const { browser, ana, appointment } = await family();
    const created = (await (
      await browser.post("/entries", dentist(appointment, [ana.id]))
    ).json()) as Entry;
    const event = await typeId(browser, "event");
    const res = await browser.request("PUT", `/entries/${created.id}`, {
      ...dentist(appointment, [ana.id]),
      entryTypeId: event,
    });
    expect(await res.json()).toMatchObject({
      entryTypeId: event,
      title: "Dentist",
      personIds: [ana.id],
    });
  });

  it("deletes an Entry for good", async () => {
    const { browser, appointment } = await family();
    const created = (await (
      await browser.post("/entries", dentist(appointment, []))
    ).json()) as Entry;
    expect((await browser.delete(`/entries/${created.id}`)).status).toBe(204);
    expect((await browser.get(`/entries/${created.id}`)).status).toBe(404);
  });

  it("keeps a Person mentioned by an Entry from being deleted", async () => {
    const { browser, ana, appointment } = await family();
    await browser.post("/entries", dentist(appointment, [ana.id]));
    expect((await browser.delete(`/persons/${ana.id}`)).status).toBe(409);
  });

  it("moves a deleted type's Entries to the chosen type or to General", async () => {
    const { browser } = await family();
    const booking = await typeId(browser, "booking");
    const event = await typeId(browser, "event");
    const general = await typeId(browser, "general");
    const a = (await (await browser.post("/entries", dentist(booking, []))).json()) as Entry;
    const b = (await (await browser.post("/entries", dentist(booking, []))).json()) as Entry;
    await browser.request("DELETE", `/entry-types/${booking}`, { moves: { [a.id]: event } });
    expect(((await (await browser.get(`/entries/${a.id}`)).json()) as Entry).entryTypeId).toBe(
      event,
    );
    expect(((await (await browser.get(`/entries/${b.id}`)).json()) as Entry).entryTypeId).toBe(
      general,
    );
  });
});
