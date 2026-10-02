import { describe, expect, it } from "vitest";
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

  it("refuses a period that ends before it starts or has no end", async () => {
    const { browser } = await family();
    const backwards = await browser.post("/checklists", {
      name: "Packing",
      startDate: "2026-08-10",
      endDate: "2026-08-01",
    });
    expect(await backwards.json()).toMatchObject({ field: "endDate" });
    const open = await browser.post("/checklists", { name: "Packing", startDate: "2026-08-10" });
    expect(open.status).toBe(400);
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
