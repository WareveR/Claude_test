import { describe, expect, it } from "vitest";
import { setUpFamily, type TestBrowser } from "../test/client";

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
  return { browser, ana };
}

const json = async <T>(res: Response) => (await res.json()) as T;

describe("Converting between Entries and Tasks", () => {
  it("turns an Entry into a Task, keeping what both have and unlinking its Preparation", async () => {
    const { browser, ana } = await family();
    const entry = await json<{ id: string }>(
      await browser.post("/entries", {
        title: "Dentist",
        entryTypeId: await typeId(browser, "appointment"),
        time: {
          allDay: false,
          startDate: "2036-10-13",
          startTime: "15:00",
          endDate: "2036-10-13",
          endTime: "15:45",
        },
        personIds: [ana.id],
        importance: "high",
        location: "Clínica",
        notes: "Bring the card",
        private: true,
        reminders: [60],
      }),
    );
    const prep = await json<{ id: string }>(
      await browser.post("/tasks", { title: "Find the card", entryId: entry.id }),
    );

    const res = await browser.post(`/entries/${entry.id}/to-task`, {});
    expect(res.status).toBe(201);
    const { id } = await json<{ id: string }>(res);
    expect(await json(await browser.get(`/tasks/${id}`))).toMatchObject({
      title: "Dentist",
      notes: "Bring the card\nClínica",
      dueDate: "2036-10-13",
      dueTime: "15:00",
      personIds: [ana.id],
      private: true,
      importance: "high",
      entryId: null,
    });
    expect((await browser.get(`/entries/${entry.id}`)).status).toBe(404);
    expect(await json(await browser.get(`/tasks/${prep.id}`))).toMatchObject({ entryId: null });
  });

  it("turns a loose Task into an Entry of the General type", async () => {
    const { browser, ana } = await family();
    const task = await json<{ id: string }>(
      await browser.post("/tasks", {
        title: "Pay the rent",
        notes: "Landlord",
        dueDate: "2036-11-01",
        dueTime: "09:30",
        personIds: [ana.id],
        importance: "high",
        repetition: { frequency: "monthly", interval: 1, end: { type: "never" } },
      }),
    );
    const res = await browser.post(`/tasks/${task.id}/to-entry`, {});
    expect(res.status).toBe(201);
    const { id } = await json<{ id: string }>(res);
    expect(await json(await browser.get(`/entries/${id}`))).toMatchObject({
      title: "Pay the rent",
      notes: "Landlord",
      entryTypeId: await typeId(browser, "general"),
      time: { allDay: false, startDate: "2036-11-01", startTime: "09:30" },
      personIds: [ana.id],
      importance: "high",
      reminders: [],
      repetition: { frequency: "monthly" },
    });
    expect((await browser.get(`/tasks/${task.id}`)).status).toBe(404);
  });

  it("keeps a Task with items as the new Entry's Preparation", async () => {
    const { browser, ana } = await family();
    const list = await json<{ id: string }>(
      await browser.post("/checklists", {
        name: "Holiday packing",
        startDate: "2036-08-01",
        endDate: "2036-08-03",
        personIds: [ana.id],
        items: ["Swimsuit"],
      }),
    );
    const res = await browser.post(`/checklists/${list.id}/to-entry`, {});
    expect(res.status).toBe(201);
    const { id } = await json<{ id: string }>(res);
    expect(await json(await browser.get(`/entries/${id}`))).toMatchObject({
      title: "Holiday packing",
      time: { allDay: true, startDate: "2036-08-01", endDate: "2036-08-03" },
      personIds: [ana.id],
    });
    expect(await json(await browser.get(`/checklists/${list.id}`))).toMatchObject({
      entryId: id,
    });
  });

  it("leaves a synced Birthday and a Checklist's items alone", async () => {
    const { browser } = await family();
    const rita = await json<{ id: string }>(
      await browser.post("/persons", { name: "Rita", color: "#81b29a", dateOfBirth: "2015-03-02" }),
    );
    const entries = await json<{ id: string; birthdayPersonId: string | null }[]>(
      await browser.get(`/entries?entryTypeId=${await typeId(browser, "birthday")}`),
    );
    const birthday = entries.find((e) => e.birthdayPersonId === rita.id)!;
    expect((await browser.post(`/entries/${birthday.id}/to-task`, {})).status).toBe(409);

    const list = await json<{ id: string }>(
      await browser.post("/checklists", { name: "Shopping", items: ["Milk"] }),
    );
    const tasks = await json<{ id: string; checklistId: string | null }[]>(
      await browser.get("/tasks"),
    );
    const item = tasks.find((t) => t.checklistId === list.id)!;
    expect((await browser.post(`/tasks/${item.id}/to-entry`, {})).status).toBe(400);
  });
});
