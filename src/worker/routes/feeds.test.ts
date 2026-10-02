import { describe, expect, it } from "vitest";
import { setUpFamily, TestBrowser } from "../test/client";

type Feed = { id: string; name: string; personIds: string[]; familyWide: boolean; url?: string };

async function family() {
  const browser = await setUpFamily();
  const person = async (name: string) =>
    ((await (await browser.post("/persons", { name, color: "#e07a5f" })).json()) as { id: string })
      .id;
  const ana = await person("Ana");
  const rui = await person("Rui");
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  const typeId = types.find((t) => t.builtinKey === "appointment")!.id;
  const addEntry = async (patch: Record<string, unknown>) =>
    (
      (await (
        await browser.post("/entries", {
          title: "Entry",
          entryTypeId: typeId,
          time: {
            allDay: false,
            startDate: "2026-10-13",
            startTime: "15:00",
            endDate: "2026-10-13",
            endTime: "15:45",
          },
          personIds: [],
          ...patch,
        })
      ).json()) as { id: string }
    ).id;
  return { browser, ana, rui, addEntry };
}

/** Reads a Feed the way a calendar app does: no session, no Origin. */
async function read(url: string) {
  const app = new TestBrowser("192.0.2.80");
  return app.request("GET", new URL(url).pathname.replace(/^\/api/, ""), undefined, {
    Origin: "",
  });
}

describe("Calendar Feeds", () => {
  it("shows the address once and keeps only the Feed's settings", async () => {
    const { browser, ana } = await family();
    const res = await browser.post("/feeds", { name: "Trabalho", personIds: [ana] });
    expect(res.status).toBe(201);
    const feed = (await res.json()) as Feed;
    expect(feed).toMatchObject({ name: "Trabalho", personIds: [ana], familyWide: true });
    expect(feed.url).toMatch(/^https:\/\/calendar\.example\/api\/feed\/[\w-]{43}\.ics$/);

    const list = (await (await browser.get("/feeds")).json()) as Feed[];
    expect(list).toHaveLength(1);
    expect(list[0].url).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain(new URL(feed.url!).pathname.slice(10, 40));

    expect((await browser.post("/feeds", { name: " " })).status).toBe(400);
    expect((await browser.post("/feeds", { name: "x", personIds: ["nobody"] })).status).toBe(400);
  });

  it("serves the .ics without a session and only with the right secret", async () => {
    const { browser, addEntry } = await family();
    await addEntry({ title: "Reunião de pais" });
    const feed = (await (await browser.post("/feeds", { name: "Família" })).json()) as Feed;

    const res = await read(feed.url!);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("X-WR-CALNAME:Família");
    expect(ics).toContain("SUMMARY:Reunião de pais");
    expect(ics).toContain("DTSTART;TZID=Europe/Lisbon:20261013T150000");

    expect((await read(feed.url!.replace(/.{6}\.ics$/, "AAAAAA.ics"))).status).toBe(404);
    expect((await read(feed.url!.replace(/\.ics$/, ""))).status).toBe(404);
    expect((await new TestBrowser("192.0.2.81").get("/feeds")).status).toBe(401);
  });

  it("covers the chosen Persons and, by its switch, Family-wide Entries", async () => {
    const { browser, ana, rui, addEntry } = await family();
    await addEntry({ title: "Ana dentist", personIds: [ana] });
    await addEntry({ title: "Rui football", personIds: [rui] });
    await addEntry({ title: "Family dinner" });
    await browser.post("/tasks", { title: "Buy bread", dueDate: "2026-10-13", personIds: [ana] });

    const anaOnly = (await (
      await browser.post("/feeds", { name: "Ana", personIds: [ana], familyWide: false })
    ).json()) as Feed;
    const ics = await (await read(anaOnly.url!)).text();
    expect(ics).toContain("Ana dentist");
    expect(ics).not.toContain("Rui football");
    expect(ics).not.toContain("Family dinner");
    expect(ics).not.toContain("Buy bread");

    const withFamily = (await (
      await browser.post("/feeds", { name: "Ana+", personIds: [ana] })
    ).json()) as Feed;
    const both = await (await read(withFamily.url!)).text();
    expect(both).toContain("Family dinner");
    expect(both).not.toContain("Rui football");
  });

  it("shows Private Entries only as busy", async () => {
    const { browser, addEntry } = await family();
    await addEntry({ title: "Consulta", location: "Hospital", notes: "Jejum", private: true });
    const feed = (await (await browser.post("/feeds", { name: "Trabalho" })).json()) as Feed;
    const ics = await (await read(feed.url!)).text();
    expect(ics).toContain("SUMMARY:Ocupado");
    expect(ics).toContain("CLASS:PRIVATE");
    expect(ics).not.toMatch(/Consulta|Hospital|Jejum/);
  });

  it("writes repeating Entries as RRULE with EXDATE and RECURRENCE-ID", async () => {
    const { browser, addEntry } = await family();
    const id = await addEntry({
      title: "Natação",
      repetition: { frequency: "weekly", interval: 1, end: { type: "count", count: 10 } },
    });
    await browser.delete(`/entries/${id}/occurrences/2026-10-20`);
    const edited = await browser.request("PUT", `/entries/${id}/occurrences/2026-10-27`, {
      title: "Natação (outra piscina)",
      entryTypeId: ((await (await browser.get(`/entries/${id}`)).json()) as { entryTypeId: string })
        .entryTypeId,
      time: {
        allDay: false,
        startDate: "2026-10-27",
        startTime: "17:00",
        endDate: "2026-10-27",
        endTime: "18:00",
      },
      personIds: [],
    });
    expect(edited.status).toBe(200);

    const feed = (await (await browser.post("/feeds", { name: "Família" })).json()) as Feed;
    const ics = (await (await read(feed.url!)).text()).replace(/\r\n /g, "");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;WKST=MO;COUNT=10");
    expect(ics).toContain("EXDATE;TZID=Europe/Lisbon:20261020T150000");
    expect(ics).toContain("RECURRENCE-ID;TZID=Europe/Lisbon:20261027T150000");
    expect(ics).toContain("SUMMARY:Natação (outra piscina)");
    expect(ics.match(new RegExp(`UID:${id}`, "g"))).toHaveLength(2);
  });

  it("replace stops the old address; revoke stops the Feed", async () => {
    const { browser } = await family();
    const feed = (await (await browser.post("/feeds", { name: "Família" })).json()) as Feed;
    const replaced = (await (await browser.post(`/feeds/${feed.id}/replace`)).json()) as Feed;
    expect(replaced.url).not.toBe(feed.url);
    expect((await read(feed.url!)).status).toBe(404);
    expect((await read(replaced.url!)).status).toBe(200);

    expect((await browser.delete(`/feeds/${feed.id}`)).status).toBe(204);
    expect((await read(replaced.url!)).status).toBe(404);
    expect((await browser.get("/feeds")).json()).resolves.toEqual([]);
  });

  it("keeps a Person a Feed covers from being deleted", async () => {
    const { browser, ana } = await family();
    await browser.post("/feeds", { name: "Ana", personIds: [ana] });
    expect((await browser.delete(`/persons/${ana}`)).status).toBe(409);
  });
});
