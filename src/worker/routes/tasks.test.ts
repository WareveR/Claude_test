import { describe, expect, it } from "vitest";
import { setUpFamily } from "../test/client";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  personIds: string[];
  private: boolean;
  doneAt: string | null;
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
