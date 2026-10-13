import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PASSWORD, setUpFamily, TestBrowser } from "../test/client";

const count = async (table: string, where = "1 = 1") =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE ${where}`).first<{
    n: number;
  }>())!.n;

/** A Family with one of everything the Danger zone can delete. */
async function familyWithData() {
  const browser = await setUpFamily();
  const ana = (await (
    await browser.post("/persons", {
      name: "Ana",
      color: "#e07a5f",
      dateOfBirth: "2015-03-14",
      nicknames: ["Aninhas"],
    })
  ).json()) as { id: string };
  const swimming = (await (
    await browser.post("/entry-types", {
      name: "Natação",
      color: "#1e88e5",
      icon: "trophy",
      defaults: {},
    })
  ).json()) as { id: string };
  const entry = await browser.post("/entries", {
    title: "Natação",
    entryTypeId: swimming.id,
    time: {
      allDay: false,
      startDate: "2026-10-14",
      startTime: "18:00",
      endDate: "2026-10-14",
      endTime: "19:00",
    },
    personIds: [ana.id],
  });
  expect(entry.status).toBe(201);
  await browser.post("/tasks", { title: "Comprar fato de banho", personIds: [ana.id] });
  await browser.post("/checklists", { name: "Mala", personIds: [ana.id] });
  await browser.post("/shopping/items", { name: "Leite" });
  await browser.post("/feeds", { name: "Trabalho", personIds: [ana.id] });
  await browser.request("PUT", "/family/sleep", { sleepHours: { start: 22, end: 6 } });
  return browser;
}

describe("Danger zone", () => {
  it("deletes only the chosen parts and keeps a copy just before", async () => {
    const browser = await familyWithData();
    const tasks = await count("task");
    const res = await browser.post("/reset", {
      password: PASSWORD,
      parts: ["tasks", "shopping"],
    });
    expect(res.status).toBe(204);
    expect(await count("task")).toBe(0);
    expect(await count("checklist")).toBe(0);
    expect(await count("shopping_item")).toBe(0);
    expect(await count("person")).toBe(1);
    expect(await count("entry")).toBe(2); // Natação and Ana's synced Birthday
    expect(await count("calendar_feed")).toBe(1);

    const copies = (await env.BACKUPS.list({ prefix: "before-reset/" })).objects;
    expect(copies).toHaveLength(1);
    const copy = (await (await env.BACKUPS.get(copies[0].key))!.json()) as {
      tables: Record<string, unknown[]>;
    };
    expect(copy.tables.task).toHaveLength(tasks);
    expect(copy.tables.shopping_item).toHaveLength(1);
  });

  it("keeps synced Birthdays when only Entries go, and drops them with their Person", async () => {
    const browser = await familyWithData();
    const tasks = await count("task");
    await browser.post("/reset", { password: PASSWORD, parts: ["entries"] });
    expect(await count("entry")).toBe(1);
    expect(await count("entry", "birthday_person_id IS NOT NULL")).toBe(1);

    await browser.post("/reset", { password: PASSWORD, parts: ["persons"] });
    expect(await count("entry")).toBe(0);
    expect(await count("person")).toBe(0);
    expect(await count("person_nickname")).toBe(0);
    expect(await count("task_person")).toBe(0);
    expect(await count("calendar_feed_person")).toBe(0);
    expect(await count("task")).toBe(tasks);
  });

  it("moves Entries of a deleted Entry Type to General and restores the built-in ones", async () => {
    const browser = await familyWithData();
    await env.DB.prepare(
      "UPDATE entry_type SET name = 'Consultas', color = '#000000' WHERE builtin_key = 'appointment'",
    ).run();
    await browser.post("/reset", { password: PASSWORD, parts: ["entryTypes"] });
    expect(await count("entry_type", "builtin_key IS NULL")).toBe(0);
    expect(await count("entry_type", "builtin_key = 'appointment' AND name IS NULL")).toBe(1);
    const moved = await env.DB.prepare(
      "SELECT t.builtin_key AS key FROM entry e JOIN entry_type t ON t.id = e.entry_type_id WHERE e.title = 'Natação'",
    ).first<{ key: string }>();
    expect(moved!.key).toBe("general");
  });

  it("starts again as a new Family, keeping the password and this device signed in", async () => {
    const browser = await familyWithData();
    const res = await browser.post("/reset", {
      password: PASSWORD,
      parts: [
        "entries",
        "tasks",
        "shopping",
        "persons",
        "entryTypes",
        "templates",
        "settings",
        "errors",
      ],
    });
    expect(res.status).toBe(204);
    for (const table of [
      "entry",
      "task",
      "checklist",
      "person",
      "shopping_item",
      "calendar_feed",
    ]) {
      expect(await count(table)).toBe(0);
    }
    expect(await count("entry_type")).toBeGreaterThan(0);
    expect(await count("checklist_template")).toBeGreaterThan(0);
    const status = (await (await browser.get("/status")).json()) as {
      signedIn: boolean;
      family: { name: string; sleepHours: unknown };
    };
    expect(status.signedIn).toBe(true);
    expect(status.family.name).toBe("Pires");
    expect(status.family.sleepHours).toEqual({ start: 23, end: 7 });
  });

  it("only checks the password when asked, and refuses a wrong one or no parts", async () => {
    const browser = await familyWithData();
    const check = await browser.post("/reset", {
      password: PASSWORD,
      parts: ["shopping"],
      check: true,
    });
    expect(check.status).toBe(204);
    expect(await count("shopping_item")).toBe(1);

    const wrong = await browser.post("/reset", { password: "nope", parts: ["shopping"] });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "wrong_password" });
    expect((await browser.post("/reset", { password: PASSWORD, parts: [] })).status).toBe(400);
    expect(
      (await browser.post("/reset", { password: PASSWORD, parts: ["everything"] })).status,
    ).toBe(400);
    expect(await count("shopping_item")).toBe(1);
  });

  it("needs a signed-in device", async () => {
    await familyWithData();
    const stranger = new TestBrowser();
    expect(
      (await stranger.post("/reset", { password: PASSWORD, parts: ["shopping"] })).status,
    ).toBe(401);
  });
});
