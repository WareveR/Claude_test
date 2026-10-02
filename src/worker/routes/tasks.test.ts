import { describe, expect, it } from "vitest";
import { todayIn, weekday } from "../../core/plain-date";
import { setUpFamily, type TestBrowser } from "../test/client";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  personIds: string[];
  private: boolean;
  doneAt: string | null;
  repetition: unknown;
  seriesId: string | null;
};

async function family() {
  const browser = await setUpFamily();
  const ana = (await (
    await browser.post("/persons", { name: "Ana", color: "#e07a5f" })
  ).json()) as { id: string };
  return { browser, ana };
}

describe("Tasks", () => {
  it("creates, lists, edits and deletes a Task", async () => {
    const { browser, ana } = await family();
    const created = await browser.post("/tasks", {
      title: " Buy school books ",
      notes: "Ask for the list",
      dueDate: "2026-10-09",
      dueTime: "18:00",
      personIds: [ana.id],
      private: true,
    });
    expect(created.status).toBe(201);
    const task = (await created.json()) as Task;
    expect(task).toMatchObject({
      title: "Buy school books",
      dueDate: "2026-10-09",
      dueTime: "18:00",
      personIds: [ana.id],
      private: true,
      doneAt: null,
    });

    const edited = await browser.request("PUT", `/tasks/${task.id}`, {
      ...task,
      dueDate: null,
      dueTime: null,
      personIds: [],
    });
    expect(await edited.json()).toMatchObject({ dueDate: null, personIds: [] });
    expect(((await (await browser.get("/tasks")).json()) as Task[]).map((t) => t.id)).toEqual([
      task.id,
    ]);

    expect((await browser.delete(`/tasks/${task.id}`)).status).toBe(204);
    expect((await browser.get(`/tasks/${task.id}`)).status).toBe(404);
  });

  it("refuses a Task without a title or with a time but no date", async () => {
    const { browser } = await family();
    expect(await (await browser.post("/tasks", { title: " " })).json()).toMatchObject({
      field: "title",
    });
    const timeOnly = await browser.post("/tasks", { title: "Call", dueTime: "10:00" });
    expect(timeOnly.status).toBe(400);
    expect(await timeOnly.json()).toMatchObject({ field: "dueTime" });
  });

  it("ticks a Task done, recording when, and undoes it", async () => {
    const { browser } = await family();
    const task = (await (await browser.post("/tasks", { title: "Water plants" })).json()) as Task;
    const done = (await (await browser.post(`/tasks/${task.id}/done`)).json()) as Task;
    expect(done.doneAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const again = (await (await browser.post(`/tasks/${task.id}/done`)).json()) as Task;
    expect(again.doneAt).toBe(done.doneAt);
    const undone = (await (await browser.delete(`/tasks/${task.id}/done`)).json()) as Task;
    expect(undone.doneAt).toBeNull();
  });

  it("keeps a Person mentioned by a Task from being deleted", async () => {
    const { browser, ana } = await family();
    await browser.post("/tasks", { title: "Dentist form", personIds: [ana.id] });
    expect((await browser.delete(`/persons/${ana.id}`)).status).toBe(409);
  });

  it("needs a signed-in device", async () => {
    const { browser } = await family();
    await browser.delete("/session");
    expect((await browser.get("/tasks")).status).toBe(401);
  });
});

describe("repeating Tasks", () => {
  const weekly = { frequency: "weekly", interval: 1, end: { type: "never" } };
  const all = async (browser: TestBrowser) =>
    (await (await browser.get("/tasks")).json()) as Task[];

  async function bins() {
    const { browser, ana } = await family();
    // Due on a Monday long ago: ticking it must not bring up another overdue Task.
    const task = (await (
      await browser.post("/tasks", {
        title: "Take out the bins",
        dueDate: "2026-01-05",
        dueTime: "20:00",
        personIds: [ana.id],
        repetition: weekly,
      })
    ).json()) as Task;
    return { browser, ana, task };
  }

  it("needs a due date to repeat", async () => {
    const { browser } = await family();
    const res = await browser.post("/tasks", { title: "Bins", repetition: weekly });
    expect(await res.json()).toMatchObject({ field: "repetition" });
  });

  it("brings up the next Task on the first Repetition date after today", async () => {
    const { browser, ana, task } = await bins();
    const done = (await (await browser.post(`/tasks/${task.id}/done`)).json()) as Task;
    expect(done.doneAt).not.toBeNull();
    const next = (await all(browser)).find((t) => t.id !== task.id)!;
    const today = todayIn("Europe/Lisbon");
    expect(next).toMatchObject({
      title: "Take out the bins",
      dueTime: "20:00",
      personIds: [ana.id],
      repetition: weekly,
      seriesId: task.id,
      doneAt: null,
    });
    expect(next.dueDate! > today).toBe(true);
    expect(weekday(next.dueDate!)).toBe(0);

    // Ticking again changes nothing: one undone Task at a time.
    await browser.post(`/tasks/${task.id}/done`);
    expect(await all(browser)).toHaveLength(2);
  });

  it("removes the untouched next Task when the tick is undone", async () => {
    const { browser, task } = await bins();
    await browser.post(`/tasks/${task.id}/done`);
    await browser.delete(`/tasks/${task.id}/done`);
    const tasks = await all(browser);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].doneAt).toBeNull();
  });

  it("keeps a next Task someone already edited", async () => {
    const { browser, task } = await bins();
    await browser.post(`/tasks/${task.id}/done`);
    const next = (await all(browser)).find((t) => t.id !== task.id)!;
    await browser.request("PUT", `/tasks/${next.id}`, { ...next, dueTime: "21:00" });
    await browser.delete(`/tasks/${task.id}/done`);
    expect(await all(browser)).toHaveLength(2);
  });

  it("carries an edit on to the following Tasks", async () => {
    const { browser, task } = await bins();
    await browser.request("PUT", `/tasks/${task.id}`, { ...task, title: "Bins and recycling" });
    await browser.post(`/tasks/${task.id}/done`);
    const next = (await all(browser)).find((t) => t.id !== task.id)!;
    expect(next.title).toBe("Bins and recycling");
  });
});
