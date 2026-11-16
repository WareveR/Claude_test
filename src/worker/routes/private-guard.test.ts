import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { app } from "../app";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

/**
 * Every route that names one Entry or Task by id, walked with an Account that may not see it:
 * none may change it or give its contents away. A new route under /entries/:id or /tasks/:id
 * is covered here without anyone remembering to add it, which is how S2 slipped through.
 */

const SECRET = "Prenda surpresa";
const DATE = "2026-10-23";
const TIME = {
  allDay: false,
  startDate: DATE,
  startTime: "10:00",
  endDate: DATE,
  endTime: "11:00",
};
const WEEKLY = { frequency: "weekly", interval: 1, end: { type: "never" } };

/** Routes whose id names a hidden item, with the method; GET lists are checked apart. */
function itemRoutes(prefix: "/api/entries/:id" | "/api/tasks/:id") {
  const seen = new Set<string>();
  return app.routes
    .filter((r) => r.path === prefix || r.path.startsWith(`${prefix}/`))
    .filter((r) => r.method !== "ALL")
    .map((r) => ({ method: r.method, path: r.path.replace(/^\/api/, "") }))
    .filter((r) => {
      const key = `${r.method} ${r.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function hiddenItems() {
  const david = await setUpFamily();
  const carla = await addAccount("carla@example.com", "member", "198.51.100.30");
  const types = (await (await carla.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string | null;
  }[];
  const entryTypeId = types.find((t) => t.builtinKey === "general")!.id;
  const entryBody = {
    title: SECRET,
    entryTypeId,
    time: TIME,
    repetition: WEEKLY,
    personIds: [],
    private: true,
  };
  const entry = (await (await carla.post("/entries", entryBody)).json()) as { id: string };
  const task = (await (
    await carla.post("/tasks", { title: SECRET, dueDate: DATE, repetition: WEEKLY, private: true })
  ).json()) as { id: string };
  return { david, carla, entry: entry.id, task: task.id, entryBody };
}

async function expectUntouched(carla: TestBrowser, entryId: string, taskId: string) {
  const entry = (await (await carla.get(`/entries/${entryId}`)).json()) as { title: string };
  expect(entry.title).toBe(SECRET);
  const tasks = (await (await carla.get("/tasks")).json()) as { id: string; title: string }[];
  expect(tasks.find((t) => t.id === taskId)?.title).toBe(SECRET);
  const { count } = (await env.DB.prepare(
    "SELECT count(*) AS count FROM occurrence_exception",
  ).first()) as { count: number };
  expect(count).toBe(0);
}

describe("Private items are guarded on every route", () => {
  it("finds the routes to walk", () => {
    expect(itemRoutes("/api/entries/:id").length).toBeGreaterThan(5);
    expect(itemRoutes("/api/tasks/:id").length).toBeGreaterThan(5);
  });

  for (const prefix of ["/api/entries/:id", "/api/tasks/:id"] as const) {
    it(`refuses or blanks every ${prefix} route for someone who can't see the item`, async () => {
      const { david, carla, entry, task, entryBody } = await hiddenItems();
      const id = prefix.startsWith("/api/entries") ? entry : task;
      for (const route of itemRoutes(prefix)) {
        const path = route.path.replace(":id", id).replace(":date", "2026-10-30");
        const body = prefix.startsWith("/api/entries")
          ? { ...entryBody, title: "x", private: false }
          : { title: "x", dueDate: DATE, private: false, mode: "move" };
        const res = await david.request(
          route.method,
          path,
          route.method === "GET" ? undefined : body,
        );
        const text = await res.text();
        const where = `${route.method} ${route.path} → ${res.status}`;
        expect(text, where).not.toContain(SECRET);
        if (route.method !== "GET") expect([403, 404], where).toContain(res.status);
      }
      await expectUntouched(carla, entry, task);
    });
  }
});
