import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { tableNames } from "../backup";
import { setUpFamily, TestBrowser } from "../test/client";
import { EXPORTED, NOT_EXPORTED } from "./export";

type Export = { format: string; tables: Record<string, Record<string, unknown>[]> };

async function familyWithData() {
  const browser = await setUpFamily();
  const person = (await (
    await browser.post("/persons", { name: "Ana", color: "#e07a5f" })
  ).json()) as { id: string };
  await browser.request("PATCH", `/persons/${person.id}`, { archived: true });
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  await browser.post("/entries", {
    title: "Consulta",
    entryTypeId: types.find((t) => t.builtinKey === "appointment")!.id,
    time: {
      allDay: false,
      startDate: "2026-10-13",
      startTime: "15:00",
      endDate: "2026-10-13",
      endTime: "15:45",
    },
    personIds: [],
    location: "Hospital",
    private: true,
  });
  await browser.post("/feeds", { name: "Trabalho" });
  return browser;
}

describe("Export", () => {
  it("decides for every table whether it is exported", async () => {
    await setUpFamily();
    const undecided = (await tableNames(env.DB)).filter(
      (name) => !(name in EXPORTED) && !NOT_EXPORTED.has(name),
    );
    expect(undecided).toEqual([]);
  });

  it("holds the Family's data, Private items included, never secrets or devices", async () => {
    const browser = await familyWithData();
    const res = await browser.get("/export");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Export;
    expect(data.format).toBe("family-calendar-export");
    expect(data.tables.person.map((p) => p.name)).toEqual(["Ana"]);
    expect(data.tables.entry.map((e) => [e.title, e.private])).toEqual([["Consulta", 1]]);
    expect(data.tables.family[0].name).toBe("Pires");
    expect(data.tables.calendar_feed[0].name).toBe("Trabalho");

    const text = JSON.stringify(data);
    for (const secret of ["password_hash", "setup_code_hash", "secret_hash", "session_hash"]) {
      expect(text).not.toContain(secret);
    }
    expect(data.tables).not.toHaveProperty("signed_in_device");
    expect(data.tables).not.toHaveProperty("error_log");
  });

  it("downloads every Entry as .ics, Private ones in full", async () => {
    const browser = await familyWithData();
    const res = await browser.get("/export/entries.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const ics = await res.text();
    expect(ics).toContain("SUMMARY:Consulta");
    expect(ics).toContain("LOCATION:Hospital");
    expect(ics).toContain("CLASS:PRIVATE");
  });

  it("remembers when a full Export was last downloaded", async () => {
    const browser = await setUpFamily();
    const before = (await (await browser.get("/status")).json()) as {
      family: { lastExportAt: string | null };
    };
    expect(before.family.lastExportAt).toBeNull();
    const done = (await (await browser.post("/export/done")).json()) as { lastExportAt: string };
    const after = (await (await browser.get("/status")).json()) as {
      family: { lastExportAt: string | null };
    };
    expect(after.family.lastExportAt).toBe(done.lastExportAt);
  });

  it("needs a signed-in device", async () => {
    await setUpFamily();
    const stranger = new TestBrowser("192.0.2.91");
    expect((await stranger.get("/export")).status).toBe(401);
    expect((await stranger.get("/export/entries.ics")).status).toBe(401);
  });
});
