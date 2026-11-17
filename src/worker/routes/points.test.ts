import { describe, expect, it } from "vitest";
import { setUpFamily } from "../test/client";

type Standing = { personId: string; points: number; goal: number | null; reward: string };

describe("Points", () => {
  it("are earned by ticking a Task, taken back by unticking, and spent on the reward", async () => {
    const browser = await setUpFamily();
    const bia = (await (
      await browser.post("/persons", { name: "Bia", color: "#c8e6c9", nicknames: [] })
    ).json()) as { id: string };
    const points = async () => (await (await browser.get("/points")).json()) as Standing[];
    expect(await points()).toEqual([]);

    const task = (await (
      await browser.post("/tasks", { title: "Fazer a cama", personIds: [bia.id], points: 5 })
    ).json()) as { id: string; points: number };
    expect(task.points).toBe(5);
    await browser.post(`/tasks/${task.id}/done`);
    await browser.post(`/tasks/${task.id}/done`);
    expect(await points()).toEqual([{ personId: bia.id, points: 5, goal: null, reward: "" }]);
    await browser.delete(`/tasks/${task.id}/done`);
    expect(await points()).toEqual([]);
    await browser.post(`/tasks/${task.id}/done`);

    expect(
      (await browser.request("PUT", `/points/${bia.id}/goal`, { goal: 5, reward: "Cinema" }))
        .status,
    ).toBe(204);
    expect(await points()).toEqual([{ personId: bia.id, points: 5, goal: 5, reward: "Cinema" }]);
    // Deleting the Task keeps what it earned.
    await browser.delete(`/tasks/${task.id}`);
    expect((await points())[0].points).toBe(5);
    expect((await browser.post(`/points/${bia.id}/redeem`)).status).toBe(204);
    expect((await points())[0].points).toBe(0);
    expect((await browser.post(`/points/${bia.id}/redeem`)).status).toBe(409);
  });

  it("refuse a bad goal or too many points on a Task", async () => {
    const browser = await setUpFamily();
    const bia = (await (
      await browser.post("/persons", { name: "Bia", color: "#c8e6c9", nicknames: [] })
    ).json()) as { id: string };
    expect((await browser.request("PUT", `/points/${bia.id}/goal`, { goal: 0 })).status).toBe(400);
    expect((await browser.request("PUT", "/points/ghost/goal", { goal: 5 })).status).toBe(404);
    expect((await browser.post("/tasks", { title: "X", points: 101 })).status).toBe(400);
    expect((await browser.post("/tasks", { title: "X", points: 1.5 })).status).toBe(400);
  });
});
