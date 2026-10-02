import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { model } from "../ai";
import { setUpFamily, TestBrowser } from "../test/client";

type Prompt = { messages: { role: string; content: string }[] };
let prompts: Prompt[] = [];
let answer: (prompt: Prompt) => unknown;
const realRun = model.run;

beforeEach(() => {
  prompts = [];
  model.run = async (_env, input) => {
    prompts.push(input as Prompt);
    return { response: answer(input as Prompt) };
  };
});
afterEach(() => {
  model.run = realRun;
});

async function family() {
  const browser = await setUpFamily();
  const ana = (
    (await (
      await browser.post("/persons", { name: "Ana", color: "#e07a5f", nicknames: ["Aninhas"] })
    ).json()) as { id: string }
  ).id;
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  return { browser, ana, types };
}

/** The number the prompt gave a line starting with this text. */
function numberOf(prompt: Prompt, text: string) {
  const line = prompt.messages[1].content.split("\n").find((l) => l.includes(`. ${text}`))!;
  return Number(line.split(".")[0]);
}

type Created = {
  outcome: string;
  kind: string;
  values: Record<string, unknown> & { time?: Record<string, unknown> };
  summary: string;
};

describe("Voice Entry: create", () => {
  it("fills a new Entry from the sentence and the Entry Type's defaults, without saving it", async () => {
    const { browser, ana, types } = await family();
    answer = (p) => ({
      kind: "entry",
      title: "Dentista",
      type: numberOf(p, "appointment"),
      persons: [numberOf(p, "Ana")],
      date: "2026-10-06",
      time: "15:00",
      endDate: null,
      endTime: null,
      allDay: null,
      location: null,
      importance: null,
      repeat: null,
    });
    const res = await browser.post("/voice", { sentence: "dentista para a Aninhas terça às 3" });
    const created = (await res.json()) as Created;
    expect(created).toMatchObject({
      outcome: "create",
      kind: "entry",
      values: {
        title: "Dentista",
        entryTypeId: types.find((t) => t.builtinKey === "appointment")!.id,
        personIds: [ana],
        time: {
          allDay: false,
          startDate: "2026-10-06",
          startTime: "15:00",
          endDate: "2026-10-06",
          endTime: "16:00",
        },
        reminders: [1440, 60],
      },
      summary: "Nova entrada: Dentista, para Ana, terça-feira, 6 de outubro, 15:00",
    });
    const prompt = JSON.stringify(prompts[0]);
    expect(prompt).toContain("Aninhas");
    expect(prompt).toContain("European Portuguese");
    // Nothing saved yet; the values are what POST /entries takes.
    expect(await (await browser.get("/entries?from=2026-10-01&to=2026-10-31")).json()).toEqual([]);
    expect((await browser.post("/entries", created.values)).status).toBe(201);
  });

  it("makes a Task when the sentence is something to do", async () => {
    const { browser, ana } = await family();
    answer = (p) => ({
      kind: "task",
      title: "Pay the school",
      type: null,
      persons: [numberOf(p, "Ana")],
      date: "2026-10-09",
      time: null,
      allDay: null,
      repeat: { frequency: "monthly", interval: 1, weekdays: null },
    });
    const created = (await (
      await browser.post("/voice", { sentence: "pay the school by Friday, every month" })
    ).json()) as Created;
    expect(created).toMatchObject({
      kind: "task",
      values: {
        title: "Pay the school",
        dueDate: "2026-10-09",
        dueTime: null,
        personIds: [ana],
        repetition: { frequency: "monthly", interval: 1, end: { type: "never" } },
        checklistId: null,
      },
    });
    expect((await browser.post("/tasks", created.values)).status).toBe(201);
  });

  it("drops what makes no sense and fails without a title, so the plain form opens", async () => {
    const { browser } = await family();
    answer = () => ({
      kind: "entry",
      title: "Party",
      type: 99,
      persons: [7],
      date: "next friday",
      time: "25:00",
      allDay: null,
    });
    const party = (await (await browser.post("/voice", { sentence: "party" })).json()) as Created;
    expect(party.values).toMatchObject({ title: "Party", personIds: [] });
    expect(party.values.time).toMatchObject({ allDay: true });

    answer = () => ({ kind: "entry", title: "" });
    expect(await (await browser.post("/voice", { sentence: "hmm" })).json()).toEqual({
      outcome: "failed",
      sentence: "hmm",
    });
    model.run = () => Promise.reject(new Error("allowance used up"));
    expect(await (await browser.post("/voice", { sentence: "hmm" })).json()).toMatchObject({
      outcome: "failed",
    });
  });

  it("takes one sentence of reasonable length from a signed-in device", async () => {
    const { browser } = await family();
    expect((await browser.post("/voice", { sentence: "x".repeat(301) })).status).toBe(400);
    expect((await new TestBrowser("192.0.2.77").post("/voice", { sentence: "hi" })).status).toBe(
      401,
    );
  });
});

type Req = { method: string; path: string; body?: unknown };
type Plan = {
  kind: string;
  id: string;
  date: string | null;
  label: string;
  summary: string;
  scope: string;
  apply: Record<string, Req[]>;
  undo: Req[] | null;
};

/** The number the prompt gave an existing item with this title. */
function targetOf(prompt: Prompt, title: string) {
  const items = prompt.messages[1].content.split("Existing items:\n")[1].split("\n\n")[0];
  const line = items.split("\n").find((l) => l.includes(`"${title}"`))!;
  return Number(line.split(".")[0]);
}

const change = (patch: Record<string, unknown>) => ({
  action: "change",
  kind: null,
  title: null,
  type: null,
  persons: [],
  date: null,
  time: null,
  allDay: null,
  targets: [],
  several: false,
  ...patch,
});

async function send(browser: TestBrowser, requests: Req[]) {
  for (const r of requests) {
    const res = await browser.request(r.method, r.path, r.body);
    expect(res.status).toBeLessThan(300);
  }
}

describe("Voice Entry: change", () => {
  async function withPlans() {
    const { browser, ana, types } = await family();
    const typeId = types.find((t) => t.builtinKey === "general")!.id;
    const add = async (title: string, time: Record<string, unknown>, extra = {}) =>
      (
        (await (
          await browser.post("/entries", {
            title,
            entryTypeId: typeId,
            time,
            personIds: [],
            ...extra,
          })
        ).json()) as { id: string }
      ).id;
    const dinner = await add("Dinner", {
      allDay: false,
      startDate: "2026-10-05",
      startTime: "20:00",
      endDate: "2026-10-05",
      endTime: "22:00",
    });
    const swimming = await add(
      "Swimming",
      {
        allDay: false,
        startDate: "2026-09-07",
        startTime: "18:00",
        endDate: "2026-09-07",
        endTime: "19:00",
      },
      { repetition: { frequency: "weekly", interval: 1, end: { type: "never" } } },
    );
    const bins = (
      (await (
        await browser.post("/tasks", { title: "Take out the bins", personIds: [] })
      ).json()) as {
        id: string;
      }
    ).id;
    return { browser, ana, dinner, swimming, bins };
  }

  it("ticks a Task done, and Undo unticks it", async () => {
    const { browser, bins } = await withPlans();
    answer = (p) => change({ targets: [targetOf(p, "Take out the bins")], done: true });
    const res = (await (
      await browser.post("/voice", { sentence: "the bins are done" })
    ).json()) as { outcome: string; plan: Plan };
    expect(res.outcome).toBe("change");
    expect(res.plan.apply.all).toEqual([{ method: "POST", path: `/tasks/${bins}/done` }]);
    await send(browser, res.plan.apply.all);
    const done = (await (await browser.get(`/tasks/${bins}`)).json()) as { doneAt: string | null };
    expect(done.doneAt).not.toBeNull();
    await send(browser, res.plan.undo!);
    const undone = (await (await browser.get(`/tasks/${bins}`)).json()) as {
      doneAt: string | null;
    };
    expect(undone.doneAt).toBeNull();
  });

  it("moves an Entry keeping its length, and Undo moves it back", async () => {
    const { browser, ana, dinner } = await withPlans();
    answer = (p) =>
      change({
        targets: [targetOf(p, "Dinner")],
        date: "2026-10-09",
        persons: [numberOf(p, "Ana")],
      });
    const res = (await (
      await browser.post("/voice", { sentence: "dinner moves to Friday, with Ana" })
    ).json()) as { plan: Plan };
    expect(res.plan.summary).toBe("Alterar Dinner: para Ana, sexta-feira, 9 de outubro");
    await send(browser, res.plan.apply.all);
    const moved = (await (await browser.get(`/entries/${dinner}`)).json()) as {
      time: unknown;
      personIds: string[];
    };
    expect(moved.time).toEqual({
      allDay: false,
      startDate: "2026-10-09",
      startTime: "20:00",
      endDate: "2026-10-09",
      endTime: "22:00",
    });
    expect(moved.personIds).toEqual([ana]);
    await send(browser, res.plan.undo!);
    const back = (await (await browser.get(`/entries/${dinner}`)).json()) as {
      time: { startDate: string };
    };
    expect(back.time.startDate).toBe("2026-10-05");
  });

  it("asks this time or from now on for a repeating Entry; a new Repetition is from now on", async () => {
    const { browser, swimming } = await withPlans();
    answer = (p) => change({ targets: [targetOf(p, "Swimming")], on: "2026-10-12", time: "17:00" });
    const res = (await (
      await browser.post("/voice", { sentence: "swimming on the 12th is at 5" })
    ).json()) as { plan: Plan };
    expect(res.plan).toMatchObject({ scope: "ask", date: "2026-10-12", undo: null });
    await send(browser, res.plan.apply.this);
    const entry = (await (await browser.get(`/entries/${swimming}`)).json()) as {
      exceptions: { date: string; override: { time: { startTime: string } } }[];
    };
    expect(entry.exceptions).toMatchObject([
      { date: "2026-10-12", override: { time: { startTime: "17:00", endTime: "18:00" } } },
    ]);

    answer = (p) =>
      change({
        targets: [targetOf(p, "Swimming")],
        repeat: { frequency: "weekly", interval: 2, weekdays: null },
        scope: "this",
      });
    const every = (await (
      await browser.post("/voice", { sentence: "make swimming every two weeks" })
    ).json()) as { plan: Plan };
    expect(every.plan.scope).toBe("following");
    expect(Object.keys(every.plan.apply)).toEqual(["following"]);
    await send(browser, every.plan.apply.following);
  });

  it("says which one, not found, one at a time, and never deletes", async () => {
    const { browser } = await withPlans();
    answer = (p) =>
      change({
        targets: [
          targetOf(p, "Dinner"),
          targetOf(p, "Swimming"),
          targetOf(p, "Take out the bins"),
          0,
        ],
        time: "19:00",
      });
    const choose = (await (await browser.post("/voice", { sentence: "move it to 7" })).json()) as {
      outcome: string;
      options: Plan[];
    };
    expect(choose.outcome).toBe("choose");
    expect(choose.options.map((o) => o.label)).toEqual([
      "Dinner · segunda-feira, 5 de outubro",
      expect.stringContaining("Swimming"),
      "Take out the bins",
    ]);

    answer = () => change({ targets: [], time: "19:00" });
    expect(await (await browser.post("/voice", { sentence: "x" })).json()).toEqual({
      outcome: "notFound",
    });
    answer = (p) => change({ targets: [targetOf(p, "Dinner")], several: true, time: "19:00" });
    expect(await (await browser.post("/voice", { sentence: "x" })).json()).toEqual({
      outcome: "oneAtATime",
    });
    answer = (p) => ({ ...change({ targets: [targetOf(p, "Dinner")] }), action: "delete" });
    expect(await (await browser.post("/voice", { sentence: "cancel dinner" })).json()).toEqual({
      outcome: "refused",
    });
  });

  it("keeps a synced Birthday's date and Person", async () => {
    const { browser } = await withPlans();
    await browser.post("/persons", { name: "Bia", color: "#3d405b", dateOfBirth: "2016-10-20" });
    answer = (p) => change({ targets: [targetOf(p, "Bia")], date: "2026-10-21" });
    expect(
      await (await browser.post("/voice", { sentence: "Bia's birthday is the 21st" })).json(),
    ).toEqual({
      outcome: "locked",
    });
    answer = (p) => change({ targets: [targetOf(p, "Bia")], importance: "high" });
    const res = (await (
      await browser.post("/voice", { sentence: "Bia's birthday is important" })
    ).json()) as { outcome: string; plan: Plan };
    expect(res.outcome).toBe("change");
    await send(browser, res.plan.apply.all);
  });
});
