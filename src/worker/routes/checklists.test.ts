import { describe, expect, it } from "vitest";
import { todayIn } from "../../core/plain-date";
import { setUpFamily } from "../test/client";

type Checklist = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  personIds: string[];
};

async function family() {
  const browser = await setUpFamily();
  const ana = (await (
    await browser.post("/persons", { name: "Ana", color: "#e07a5f" })
  ).json()) as { id: string };
  return { browser, ana };
}

describe("Checklists", () => {
  it("creates, edits and lists a Checklist with default Persons and a period", async () => {
    const { browser, ana } = await family();
    const res = await browser.post("/checklists", {
      name: " Summer cleaning ",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      personIds: [ana.id],
    });
    expect(res.status).toBe(201);
    const checklist = (await res.json()) as Checklist;
    expect(checklist).toMatchObject({
      name: "Summer cleaning",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      personIds: [ana.id],
    });
    const edited = await browser.request("PUT", `/checklists/${checklist.id}`, {
      ...checklist,
      startDate: null,
      endDate: null,
      personIds: [],
    });
    expect(await edited.json()).toMatchObject({ startDate: null, endDate: null, personIds: [] });
    expect(await (await browser.get("/checklists")).json()).toHaveLength(1);
  });

  it("takes a start or an end on its own, but refuses an end before the start", async () => {
    const { browser } = await family();
    const backwards = await browser.post("/checklists", {
      name: "Packing",
      startDate: "2026-08-10",
      endDate: "2026-08-01",
    });
    expect(await backwards.json()).toMatchObject({ field: "endDate" });
    const open = await browser.post("/checklists", { name: "Packing", startDate: "2026-08-10" });
    expect(await open.json()).toMatchObject({ startDate: "2026-08-10", endDate: null });
    const deadline = await browser.post("/checklists", { name: "Forms", endDate: "2026-09-01" });
    expect(await deadline.json()).toMatchObject({ startDate: null, endDate: "2026-09-01" });
  });

  it("holds ordinary Tasks, each keeping its own Persons, and never repeating ones", async () => {
    const { browser, ana } = await family();
    const checklist = (await (
      await browser.post("/checklists", { name: "Back to school", personIds: [ana.id] })
    ).json()) as Checklist;
    const task = await browser.post("/tasks", {
      title: "Buy pencils",
      checklistId: checklist.id,
      personIds: [],
      private: true,
    });
    expect(await task.json()).toMatchObject({
      checklistId: checklist.id,
      personIds: [],
      private: true,
    });
    const repeating = await browser.post("/tasks", {
      title: "Check bags",
      checklistId: checklist.id,
      dueDate: "2026-09-01",
      repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
    });
    expect(await repeating.json()).toMatchObject({ field: "repetition" });
    const missing = await browser.post("/tasks", { title: "x", checklistId: "nope" });
    expect(await missing.json()).toMatchObject({ field: "checklistId" });
  });

  it("deletes its Tasks with it", async () => {
    const { browser } = await family();
    const checklist = (await (
      await browser.post("/checklists", { name: "Packing" })
    ).json()) as Checklist;
    await browser.post("/tasks", { title: "Passports", checklistId: checklist.id });
    await browser.post("/tasks", { title: "Loose task" });
    expect((await browser.delete(`/checklists/${checklist.id}`)).status).toBe(204);
    const tasks = (await (await browser.get("/tasks")).json()) as { title: string }[];
    expect(tasks.map((t) => t.title)).toEqual(["Loose task"]);
  });

  it("keeps a default Person from being deleted", async () => {
    const { browser, ana } = await family();
    await browser.post("/checklists", { name: "Packing", personIds: [ana.id] });
    expect((await browser.delete(`/persons/${ana.id}`)).status).toBe(409);
  });
});

describe("Checklist rounds", () => {
  async function summer(repetition: unknown = null) {
    const { browser } = await family();
    const checklist = (await (
      await browser.post("/checklists", {
        name: "Summer cleaning",
        startDate: "2025-07-01",
        endDate: "2025-07-31",
        repetition,
      })
    ).json()) as Checklist & { id: string };
    const ids: string[] = [];
    for (const [title, dueDate] of [
      ["Windows", "2025-07-05"],
      ["Garage", null],
    ] as const) {
      const task = (await (
        await browser.post("/tasks", { title, dueDate, checklistId: checklist.id })
      ).json()) as { id: string };
      ids.push(task.id);
    }
    await browser.post(`/tasks/${ids[0]}/done`);
    return { browser, checklist };
  }

  const tasksOf = async (browser: Awaited<ReturnType<typeof family>>["browser"]) =>
    (await (await browser.get("/tasks")).json()) as {
      title: string;
      dueDate: string | null;
      doneAt: string | null;
    }[];

  it("starts the round a repeating Checklist is due for, keeping only the result", async () => {
    const { browser, checklist } = await summer({
      frequency: "yearly",
      interval: 1,
      end: { type: "never" },
    });
    const [rolled] = (await (await browser.get("/checklists")).json()) as (Checklist & {
      rounds: unknown[];
    })[];
    // Today is after 1 July 2026, so the 2026 round (at least) has started.
    expect(rolled.startDate! > checklist.startDate!).toBe(true);
    expect(rolled.startDate!.slice(5)).toBe("07-01");
    expect(rolled.endDate!.slice(5)).toBe("07-31");
    expect(rolled.rounds).toEqual([{ label: "2025", done: 1, total: 2 }]);
    const tasks = await tasksOf(browser);
    expect(tasks.every((t) => t.doneAt === null)).toBe(true);
    // Items' own stored dates are ignored, and left as they were.
    expect(tasks.find((t) => t.title === "Windows")!.dueDate).toBe("2025-07-05");
    expect(tasks.find((t) => t.title === "Garage")!.dueDate).toBeNull();
  });

  it("starts a new round by hand with Use again, moving the period", async () => {
    const { browser, checklist } = await summer();
    const res = await browser.post(`/checklists/${checklist.id}/rounds`, {
      startDate: "2026-07-03",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      startDate: "2026-07-03",
      endDate: "2026-08-02",
      rounds: [{ label: "2025", done: 1, total: 2 }],
    });
    const windows = (await tasksOf(browser)).find((t) => t.title === "Windows")!;
    expect(windows).toMatchObject({ dueDate: "2025-07-05", doneAt: null });
  });

  it("counts a repeating Checklist's rounds from today when it has no start", async () => {
    const { browser } = await family();
    const repetition = { frequency: "daily", interval: 1, end: { type: "never" } };
    const res = await browser.post("/checklists", { name: "Tidy up", repetition });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      startDate: todayIn("Europe/Lisbon"),
      endDate: null,
      repetition,
    });
    // Every Sunday: the first round starts on the first Sunday from today.
    const sundays = { frequency: "weekly", interval: 1, weekdays: [6], end: { type: "never" } };
    const sunday = (await (
      await browser.post("/checklists", { name: "Sunday chores", repetition: sundays })
    ).json()) as Checklist;
    expect(new Date(`${sunday.startDate}T12:00:00Z`).getUTCDay()).toBe(0);
    expect(sunday.startDate! >= todayIn("Europe/Lisbon")).toBe(true);
    const bad = await browser.post("/checklists", { name: "x", repetition: { frequency: "x" } });
    expect(await bad.json()).toMatchObject({ field: "repetition" });
  });
});
