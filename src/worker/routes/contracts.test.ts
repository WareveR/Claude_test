import { describe, expect, it } from "vitest";
import { setUpFamily, type TestBrowser } from "../test/client";

type Task = { id: string; title: string; dueDate: string | null; repetition: unknown };

const tasks = async (browser: TestBrowser) =>
  (await (await browser.get("/tasks")).json()) as Task[];

const body = {
  name: "Luz",
  provider: "EDP",
  amount: 4550,
  frequency: "monthly",
  payment: "manual",
  payDay: 28,
};

describe("Contracts", () => {
  it("paid by hand keep one repeating Task to pay them, in step with them", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/contracts", body);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const [task] = await tasks(browser);
    expect(task.title).toMatch(/^Pagar Luz \(EDP\) · 45,50/u);
    expect(task.dueDate?.slice(8)).toBe("28");
    expect(task.repetition).toEqual({ frequency: "monthly", interval: 1, end: { type: "never" } });

    await browser.request("PUT", `/contracts/${id}`, { ...body, provider: "Endesa", payDay: 3 });
    const [moved] = await tasks(browser);
    expect(moved.id).toBe(task.id);
    expect(moved.title).toMatch(/Endesa/u);
    expect(moved.dueDate?.slice(8)).toBe("03");

    // Direct debit: no Task, only a notice.
    await browser.request("PUT", `/contracts/${id}`, { ...body, payment: "debit" });
    expect(await tasks(browser)).toEqual([]);
    await browser.request("PUT", `/contracts/${id}`, body);
    expect(await tasks(browser)).toHaveLength(1);
    expect((await browser.delete(`/contracts/${id}`)).status).toBe(204);
    expect(await tasks(browser)).toEqual([]);
    expect(await (await browser.get("/contracts")).json()).toEqual([]);
  });

  it("refuse a bad field", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/contracts", { ...body, payDay: 40 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid", field: "payDay" });
    expect((await browser.request("PUT", "/contracts/nothing", body)).status).toBe(404);
  });
});
