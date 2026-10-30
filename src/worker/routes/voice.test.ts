import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { model, speech } from "../ai";
import { MAX_RECORDING } from "./voice";
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
  it("makes a new Entry Private when the sentence says so", async () => {
    const { browser } = await family();
    answer = () => ({
      kind: "entry",
      title: "Médico",
      type: null,
      persons: [],
      date: "2026-10-06",
      time: "15:00",
      allDay: null,
      private: true,
    });
    const created = (await (
      await browser.post("/voice", { sentence: "privado: médico terça às 3" })
    ).json()) as Created;
    expect(created.values.private).toBe(true);
    expect(created.summary).toContain("privada");
  });

  it("takes the Reminders the sentence asks for", async () => {
    const { browser } = await family();
    answer = () => ({
      kind: "entry",
      title: "Dentista",
      type: null,
      persons: [],
      date: "2026-10-06",
      time: "15:00",
      allDay: null,
      reminders: [60, 60, -5, 30],
    });
    const created = (await (
      await browser.post("/voice", { sentence: "dentista terça às 3, lembra-me 1 hora antes" })
    ).json()) as Created;
    expect(created.values.reminders).toEqual([30, 60]);
    expect(created.summary).toContain("lembrete 30 min antes e 1 h antes");
  });

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

  it("gives a new Entry the icon its title names, not its group type's", async () => {
    const { browser } = await family();
    answer = (p) => ({
      kind: "entry",
      title: "Ginásio",
      type: numberOf(p, "activity"),
      persons: [],
      date: "2026-10-06",
      time: "19:00",
      endDate: null,
      endTime: null,
      allDay: null,
      location: null,
      importance: null,
      repeat: null,
    });
    const created = (await (
      await browser.post("/voice", { sentence: "ginásio terça às 19h" })
    ).json()) as Created;
    expect(created.values.icon).toBe("gym");
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

  it("gives a Task the items the sentence names, as a Checklist that Undo deletes", async () => {
    const { browser, ana } = await family();
    answer = (p) => ({
      kind: "task",
      title: "Prepare the trip",
      type: null,
      persons: [numberOf(p, "Ana")],
      date: "2026-10-09",
      time: "18:00",
      allDay: null,
      repeat: null,
      items: ["Passports", " Chargers ", "", "Passports", 3],
      list: null,
    });
    const created = (await (
      await browser.post("/voice", { sentence: "prepare the trip: passports and chargers" })
    ).json()) as Created & { form: unknown };
    expect(created).toMatchObject({
      kind: "checklist",
      values: {
        name: "Prepare the trip",
        endDate: "2026-10-09",
        personIds: [ana],
        items: ["Passports", "Chargers"],
      },
      form: { templateId: null, items: ["Passports", "Chargers"] },
    });
    expect(created.summary).toMatch(/2 (items|itens)$/);
    const res = await browser.post("/checklists", created.values);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const items = (
      (await (await browser.get("/tasks")).json()) as { checklistId: string }[]
    ).filter((t) => t.checklistId === id);
    expect(items).toHaveLength(2);
    expect((await browser.delete(`/checklists/${id}`)).status).toBe(204);
  });

  it("gives a Task the items of the predefined list the sentence names, and its own", async () => {
    const { browser } = await family();
    let beach = -1;
    answer = (p) => {
      const line = p.messages[1].content
        .split("\n")
        .find((l) => /^\d+\. (Beach day|Dia de praia)$/.test(l))!;
      beach = Number(line.split(".")[0]);
      return {
        kind: "task",
        title: "Beach",
        type: null,
        persons: [],
        date: null,
        time: null,
        allDay: null,
        repeat: null,
        items: ["Kite"],
        list: beach,
      };
    };
    const created = (await (
      await browser.post("/voice", { sentence: "beach with the beach day list and the kite" })
    ).json()) as Created & { form: { templateId: string } };
    const templates = (await (await browser.get("/checklist-templates")).json()) as {
      id: string;
      builtinKey: string;
    }[];
    expect(created.form.templateId).toBe(templates.find((t) => t.builtinKey === "beachDay")!.id);
    const items = created.values.items as string[];
    expect(items.length).toBeGreaterThan(2);
    expect(items.at(-1)).toBe("Kite");
    expect(created.summary).toMatch(/(Beach day|Dia de praia).*1 item$/);
    expect((await browser.post("/checklists", created.values)).status).toBe(201);
  });

  it("makes one Entry for each person when the sentence names several appointments", async () => {
    const { browser, ana, types } = await family();
    const rui = (
      (await (await browser.post("/persons", { name: "Rui", color: "#3d405b" })).json()) as {
        id: string;
      }
    ).id;
    const massage = (p: Prompt, who: string, time: string) => ({
      kind: "entry",
      title: "Massagem",
      type: numberOf(p, "appointment"),
      persons: [numberOf(p, who)],
      date: "2026-10-23",
      time,
      endDate: null,
      endTime: null,
      allDay: null,
      location: null,
      importance: null,
      repeat: null,
    });
    answer = (p) => ({
      action: "create",
      ...massage(p, "Rui", "10:00"),
      others: [massage(p, "Ana", "11:00"), { kind: "entry", title: "" }],
    });
    const created = (await (
      await browser.post("/voice", {
        sentence: "tenho uma massagem na sexta às 10h e a minha mulher tem outra às 11h",
      })
    ).json()) as Created & { more: Created[] };
    const appointment = types.find((t) => t.builtinKey === "appointment")!.id;
    expect(created).toMatchObject({
      outcome: "create",
      kind: "entry",
      values: {
        entryTypeId: appointment,
        personIds: [rui],
        time: { startTime: "10:00", endTime: "11:00" },
      },
    });
    // The one without a title is dropped.
    expect(created.more).toHaveLength(1);
    expect(created.more[0]).toMatchObject({
      kind: "entry",
      values: {
        title: "Massagem",
        entryTypeId: appointment,
        personIds: [ana],
        time: { startDate: "2026-10-23", startTime: "11:00", endTime: "12:00" },
      },
      summary: "Nova entrada: Massagem, para Ana, sexta-feira, 23 de outubro, 11:00",
    });
    expect(JSON.stringify(prompts[0])).toContain('"others"');
    expect((await browser.post("/entries", created.more[0].values)).status).toBe(201);

    answer = (p) => massage(p, "Ana", "11:00");
    expect(
      (await (await browser.post("/voice", { sentence: "massagem da Ana" })).json()) as {
        more: unknown[];
      },
    ).toMatchObject({ outcome: "create", more: [] });
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
  // The Entries below sit around early October 2026; changes only look 7 days back.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("says which one, not found and one at a time", async () => {
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
  });

  const remove = (patch: Record<string, unknown>) => ({ ...change(patch), action: "delete" });

  it("deletes a one-off Entry or a Task, asked as Delete and never undone", async () => {
    const { browser, dinner, bins } = await withPlans();
    answer = (p) => remove({ targets: [targetOf(p, "Dinner")] });
    const res = (await (await browser.post("/voice", { sentence: "cancel dinner" })).json()) as {
      outcome: string;
      plan: Plan & { remove: boolean };
    };
    expect(res.outcome).toBe("change");
    expect(res.plan).toMatchObject({
      remove: true,
      undo: null,
      scope: "all",
      summary: "Apagar Dinner · segunda-feira, 5 de outubro",
    });
    await send(browser, res.plan.apply.all);
    expect((await browser.get(`/entries/${dinner}`)).status).toBe(404);

    answer = (p) => remove({ targets: [targetOf(p, "Take out the bins")] });
    const task = (await (
      await browser.post("/voice", { sentence: "delete the bins task" })
    ).json()) as { plan: Plan };
    await send(browser, task.plan.apply.all);
    expect((await browser.get(`/tasks/${bins}`)).status).toBe(404);
  });

  it("deletes one Occurrence or from it on, asking which when the sentence doesn't say", async () => {
    const { browser, swimming } = await withPlans();
    answer = (p) => remove({ targets: [targetOf(p, "Swimming")], on: "2026-10-12" });
    const res = (await (
      await browser.post("/voice", { sentence: "no swimming on the 12th" })
    ).json()) as { plan: Plan };
    expect(res.plan).toMatchObject({ scope: "ask", date: "2026-10-12" });
    await send(browser, res.plan.apply.this);
    const entry = (await (await browser.get(`/entries/${swimming}`)).json()) as {
      exceptions: { date: string; skipped: boolean }[];
    };
    expect(entry.exceptions).toMatchObject([{ date: "2026-10-12", skipped: true }]);

    answer = (p) =>
      remove({ targets: [targetOf(p, "Swimming")], on: "2026-10-19", scope: "following" });
    const following = (await (
      await browser.post("/voice", { sentence: "no more swimming from the 19th" })
    ).json()) as { plan: Plan };
    expect(following.plan.scope).toBe("following");
    await send(browser, following.plan.apply.following);
    const ended = (await (await browser.get(`/entries/${swimming}`)).json()) as {
      repetition: { end: unknown };
    };
    expect(ended.repetition.end).toEqual({ type: "until", date: "2026-10-18" });
  });

  it("deletes a synced Birthday only through its Person", async () => {
    const { browser } = await withPlans();
    await browser.post("/persons", { name: "Bia", color: "#3d405b", dateOfBirth: "2016-10-20" });
    answer = (p) => remove({ targets: [targetOf(p, "Bia")] });
    expect(
      await (await browser.post("/voice", { sentence: "delete Bia's birthday" })).json(),
    ).toEqual({
      outcome: "locked",
    });
  });

  it("sets an Entry's Reminders, replacing its own, and Undo puts them back", async () => {
    const { browser, dinner } = await withPlans();
    answer = (p) => change({ targets: [targetOf(p, "Dinner")], reminders: [1440, 60] });
    const res = (await (
      await browser.post("/voice", { sentence: "lembra-me do jantar na véspera e 1 hora antes" })
    ).json()) as { plan: Plan };
    expect(res.plan.summary).toBe("Alterar Dinner: lembrete 1 h antes e 1 dia antes");
    await send(browser, res.plan.apply.all);
    const reminders = async () =>
      ((await (await browser.get(`/entries/${dinner}`)).json()) as { reminders: number[] })
        .reminders;
    expect((await reminders()).sort((a, b) => a - b)).toEqual([60, 1440]);
    await send(browser, res.plan.undo!);
    expect(await reminders()).toEqual([]);
  });

  it("makes an Entry or a Task Private, or not", async () => {
    const { browser, dinner, bins } = await withPlans();
    answer = (p) => change({ targets: [targetOf(p, "Dinner")], private: true });
    const res = (await (
      await browser.post("/voice", { sentence: "o jantar é privado" })
    ).json()) as { plan: Plan };
    expect(res.plan.summary).toBe("Alterar Dinner: privado");
    await send(browser, res.plan.apply.all);
    expect(
      ((await (await browser.get(`/entries/${dinner}`)).json()) as { private: boolean }).private,
    ).toBe(true);
    answer = (p) => change({ targets: [targetOf(p, "Take out the bins")], private: true });
    const task = (await (
      await browser.post("/voice", { sentence: "a tarefa do lixo é privada" })
    ).json()) as { plan: Plan };
    await send(browser, task.plan.apply.all);
    expect(
      ((await (await browser.get(`/tasks/${bins}`)).json()) as { private: boolean }).private,
    ).toBe(true);
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

describe("Voice Entry: Persons and predefined lists", () => {
  const blank = {
    kind: null,
    type: null,
    persons: [],
    time: null,
    allDay: null,
    targets: [],
  };

  it("proposes a new Person with a free colour, and says when the name is taken", async () => {
    const { browser } = await family();
    answer = () => ({
      ...blank,
      action: "person",
      title: "Maria",
      date: "2015-05-03",
      nicknames: ["Mimi", "maria", ""],
    });
    const created = (await (
      await browser.post("/voice", { sentence: "add Maria, born 3 May 2015, we call her Mimi" })
    ).json()) as Created;
    expect(created).toMatchObject({
      outcome: "create",
      kind: "person",
      values: { name: "Maria", dateOfBirth: "2015-05-03", nicknames: ["Mimi"], photoKey: null },
    });
    expect(created.values.color).not.toBe("#e07a5f");
    expect(created.summary).toMatch(/Maria.*Mimi.*2015/);
    expect((await browser.post("/persons", created.values)).status).toBe(201);

    answer = () => ({ ...blank, action: "person", title: "aninhas", date: null });
    expect(await (await browser.post("/voice", { sentence: "add Aninhas" })).json()).toEqual({
      outcome: "personExists",
    });
  });

  it("proposes a new predefined list with its items, and says when the name is taken", async () => {
    const { browser } = await family();
    answer = () => ({
      ...blank,
      action: "list",
      title: "Picnic",
      date: null,
      items: ["Blanket", " Sandwiches ", "Blanket", ""],
    });
    const created = (await (
      await browser.post("/voice", {
        sentence: "create the predefined list Picnic with a blanket and sandwiches",
      })
    ).json()) as Created;
    expect(created).toMatchObject({
      outcome: "create",
      kind: "template",
      values: { name: "Picnic", items: ["Blanket", "Sandwiches"] },
    });
    expect(created.summary).toMatch(/Picnic.*2 (items|itens)$/);
    expect((await browser.post("/checklist-templates", created.values)).status).toBe(201);
    expect(await (await browser.post("/voice", { sentence: "the list Picnic" })).json()).toEqual({
      outcome: "listExists",
    });
  });
});

describe("Voice Entry: questions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers what is on a day, and when one thing is, without saving anything", async () => {
    const { browser, ana, types } = await family();
    await browser.post("/entries", {
      title: "Dentista",
      entryTypeId: types[0].id,
      time: {
        allDay: false,
        startDate: "2026-10-09",
        startTime: "10:00",
        endDate: "2026-10-09",
        endTime: "11:00",
      },
      personIds: [ana],
    });
    answer = () => ({ ...change({ date: "2026-10-09" }), action: "question" });
    expect(await (await browser.post("/voice", { sentence: "o que temos sexta?" })).json()).toEqual(
      { outcome: "answer", text: "sexta-feira, 9 de outubro: 10:00 Dentista (Ana)." },
    );
    answer = (p) => ({ ...change({ targets: [targetOf(p, "Dentista")] }), action: "question" });
    expect(
      await (await browser.post("/voice", { sentence: "quando é o dentista da Ana?" })).json(),
    ).toEqual({ outcome: "answer", text: "Dentista (Ana): sexta-feira, 9 de outubro, 10:00." });
  });

  it("names no speaker when the Account has no Person", async () => {
    const { browser } = await family();
    answer = () => ({ ...change({}), action: "question" });
    await browser.post("/voice", { sentence: "o que tenho hoje?" });
    expect(prompts[0].messages[1].content).not.toContain("The person speaking");
  });
});

describe("Voice Entry: items of a Task", () => {
  it("adds items to a Task with items and ticks others, and Undo takes both back", async () => {
    const { browser } = await family();
    const created = (await (
      await browser.post("/checklists", {
        name: "Praia",
        startDate: null,
        endDate: null,
        repetition: null,
        remindAtStart: false,
        entryId: null,
        personIds: [],
        items: ["Toalhas", "Chapéu"],
      })
    ).json()) as { id: string };
    const items = async () =>
      (
        (await (await browser.get("/tasks")).json()) as {
          title: string;
          checklistId: string | null;
          doneAt: string | null;
        }[]
      )
        .filter((t) => t.checklistId === created.id)
        .sort((a, b) => a.title.localeCompare(b.title));
    answer = (p) => {
      expect(p.messages[1].content).toContain("0. Praia: Toalhas, Chapéu");
      return {
        ...change({ action: "items" }),
        checklist: 0,
        items: ["Protetor solar", "toalhas"],
        tick: ["chapéu"],
      };
    };
    const res = (await (
      await browser.post("/voice", { sentence: "junta protetor solar à praia, o chapéu já está" })
    ).json()) as { plan: Plan };
    expect(res.plan.summary).toBe("Em Praia: juntar Protetor solar; feito Chapéu");
    await send(browser, res.plan.apply.all);
    expect((await items()).map((i) => [i.title, i.doneAt !== null])).toEqual([
      ["Chapéu", true],
      ["Protetor solar", false],
      ["Toalhas", false],
    ]);
    await send(browser, res.plan.undo!);
    expect((await items()).map((i) => [i.title, i.doneAt !== null])).toEqual([
      ["Chapéu", false],
      ["Toalhas", false],
    ]);
  });
});

describe("Voice Entry: Family Tree", () => {
  it("adds a relative linked to one in the tree, and changes one's dates, with Undo", async () => {
    const { browser } = await family();
    const ana = (await (await browser.post("/relatives", { name: "Ana" })).json()) as {
      id: string;
    };
    const tree = async () =>
      (await (await browser.get("/relatives")).json()) as {
        id: string;
        name: string;
        sex: string;
        parentIds: string[];
        deathDate: string | null;
      }[];
    answer = (p) => {
      expect(p.messages[1].content).toContain("Family tree:\n0. Ana");
      return {
        ...change({ action: "relative", title: "Rosa", date: "1950-03-02" }),
        relation: "parent",
        of: 0,
        sex: "f",
      };
    };
    const added = (await (
      await browser.post("/voice", { sentence: "a Rosa é mãe da Ana, nasceu a 2 de março de 1950" })
    ).json()) as { plan: Plan };
    expect(added.plan.summary).toBe(
      "Nova pessoa na árvore: Rosa, mãe de Ana, nasceu a 2 de março de 1950",
    );
    await send(browser, added.plan.apply.all);
    const rosa = (await tree()).find((r) => r.name === "Rosa")!;
    expect(rosa.sex).toBe("f");
    expect((await tree()).find((r) => r.id === ana.id)!.parentIds).toEqual([rosa.id]);

    answer = (p) => ({
      ...change({ action: "relative", endDate: "2020-05-03" }),
      relative: numberOf(p, "Rosa"),
    });
    const died = (await (
      await browser.post("/voice", { sentence: "a Rosa faleceu a 3 de maio de 2020" })
    ).json()) as { plan: Plan };
    await send(browser, died.plan.apply.all);
    expect((await tree()).find((r) => r.id === rosa.id)!.deathDate).toBe("2020-05-03");
    await send(browser, died.plan.undo!);
    expect((await tree()).find((r) => r.id === rosa.id)!.deathDate).toBeNull();
    await send(browser, added.plan.undo!);
    expect((await tree()).map((r) => r.name)).toEqual(["Ana"]);
  });
});

describe("Voice Entry: open", () => {
  it("names the place, the day and what to search for", async () => {
    const { browser } = await family();
    answer = () => ({ ...change({ date: "2026-12-01" }), action: "open", place: "month" });
    expect(await (await browser.post("/voice", { sentence: "abre dezembro" })).json()).toEqual({
      outcome: "open",
      place: "month",
      date: "2026-12-01",
      query: null,
    });
    answer = () => ({ ...change({ title: "dentista" }), action: "open", place: "search" });
    expect(
      await (await browser.post("/voice", { sentence: "procura dentista" })).json(),
    ).toMatchObject({ outcome: "open", place: "search", query: "dentista" });
    answer = () => ({ ...change({}), action: "open", place: "kitchen" });
    expect(await (await browser.post("/voice", { sentence: "abre a cozinha" })).json()).toEqual({
      outcome: "failed",
      sentence: "abre a cozinha",
    });
  });
});

describe("Voice Entry: Shopping List", () => {
  it("reads things to buy without the model, leaving out those already open on the list", async () => {
    const { browser } = await family();
    answer = () => {
      throw new Error("the model is not asked");
    };
    await browser.post("/shopping/items", { name: "Ovos" });
    // Bought earlier: it goes back on the list with its last shop.
    const leite = (await (
      await browser.post("/shopping/items", { name: "Leite", store: "Continente" })
    ).json()) as { id: string };
    await browser.request("PATCH", `/shopping/items/${leite.id}`, { bought: true });

    const res = await browser.post("/voice", { sentence: "comprar leite, ovos e pão" });
    expect(await res.json()).toEqual({
      outcome: "shopping",
      items: [
        { name: "Leite", store: "Continente" },
        { name: "Pão", store: "" },
      ],
      already: ["Ovos"],
    });
    expect(prompts).toHaveLength(0);
    // Nothing is saved: the browser adds them once the Family member says yes.
    expect(((await (await browser.get("/shopping/items")).json()) as unknown[]).length).toBe(2);
  });

  it("leaves a sentence with a day or a time to the model", async () => {
    const { browser } = await family();
    answer = () => ({
      action: "create",
      kind: "entry",
      title: "Bilhetes para o cinema",
      type: null,
      persons: [],
      date: "2026-10-17",
      time: "20:00",
      allDay: null,
      targets: [],
    });
    const res = await browser.post("/voice", {
      sentence: "comprar bilhetes para o cinema sábado às 20h",
    });
    expect(await res.json()).toMatchObject({ outcome: "create", kind: "entry" });
    expect(prompts).toHaveLength(1);
  });

  it("takes the model's shopping answer for a sentence the parser doesn't know", async () => {
    const { browser } = await family();
    answer = () => ({ ...change({ action: "shopping" }), items: ["café", " Café ", "açúcar"] });
    const res = await browser.post("/voice", { sentence: "o café e o açúcar estão no fim" });
    expect(await res.json()).toEqual({
      outcome: "shopping",
      items: [
        { name: "Café", store: "" },
        { name: "Açúcar", store: "" },
      ],
      already: [],
    });
    expect(prompts[0].messages[0].content).toContain('"shopping"');

    answer = () => ({ ...change({ action: "shopping" }), items: [] });
    expect(await (await browser.post("/voice", { sentence: "hmm" })).json()).toMatchObject({
      outcome: "failed",
    });
  });

  const shop = (patch: Record<string, unknown>) => ({
    ...change({ action: "shopping" }),
    ...patch,
  });

  it("ticks things bought or takes them off, with Undo, and says what is left", async () => {
    const { browser } = await family();
    const add = async (name: string, store = "") =>
      (
        (await (await browser.post("/shopping/items", { name, store, quantity: "" })).json()) as {
          id: string;
        }
      ).id;
    const leite = await add("Leite", "Lidl");
    const ovos = await add("Ovos");
    await add("Pão", "Padaria");

    answer = () => shop({ shop: "bought", items: ["leite"] });
    const bought = (await (
      await browser.post("/voice", { sentence: "já comprei o leite" })
    ).json()) as { outcome: string; plan: Plan };
    expect(bought.plan.summary).toBe("Comprado: Leite");
    await send(browser, bought.plan.apply.all);
    const items = async () =>
      (await (await browser.get("/shopping/items")).json()) as {
        id: string;
        boughtAt: string | null;
      }[];
    expect((await items()).find((i) => i.id === leite)!.boughtAt).not.toBeNull();
    await send(browser, bought.plan.undo!);
    expect((await items()).find((i) => i.id === leite)!.boughtAt).toBeNull();

    answer = () => shop({ shop: "remove", items: ["ovos", "chocolate"] });
    const removed = (await (
      await browser.post("/voice", { sentence: "tira os ovos e o chocolate da lista" })
    ).json()) as { plan: Plan };
    expect(removed.plan.summary).toBe("Tirar da lista de compras: Ovos");
    await send(browser, removed.plan.apply.all);
    expect((await items()).some((i) => i.id === ovos)).toBe(false);
    await send(browser, removed.plan.undo!);
    expect((await items()).some((i) => i.id === ovos)).toBe(true);

    answer = () => shop({ shop: "remove", items: ["chocolate"] });
    expect(await (await browser.post("/voice", { sentence: "tira o chocolate" })).json()).toEqual({
      outcome: "notFound",
    });

    answer = () => shop({ shop: "ask", store: "Lidl" });
    expect(
      await (await browser.post("/voice", { sentence: "o que falta comprar no Lidl?" })).json(),
    ).toEqual({ outcome: "answer", text: "Na lista de compras no Lidl: Leite, Ovos." });
  });

  it("keeps the shop said with the things to buy", async () => {
    const { browser } = await family();
    answer = () => shop({ shop: "add", items: ["leite"], store: "Lidl" });
    expect(
      await (await browser.post("/voice", { sentence: "comprar leite no Lidl" })).json(),
    ).toEqual({ outcome: "shopping", items: [{ name: "Leite", store: "Lidl" }], already: [] });
    expect(prompts).toHaveLength(1);
  });
});

describe("Voice Entry: corrections", () => {
  it("gives the model what was said after the readback, and skips the shopping shortcut", async () => {
    const { browser } = await family();
    answer = () => ({ ...change({ action: "shopping" }), items: ["leite magro"] });
    const res = await browser.post("/voice", {
      sentence: "comprar leite",
      corrections: ["não, leite magro"],
    });
    expect(await res.json()).toMatchObject({ outcome: "shopping" });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].messages[1].content).toContain('Sentence: "comprar leite"');
    expect(prompts[0].messages[1].content).toContain('- "não, leite magro"');
  });

  it("refuses corrections that aren't short text", async () => {
    const { browser } = await family();
    for (const corrections of [[""], [1], Array(6).fill("às 11"), ["x".repeat(301)]]) {
      const res = await browser.post("/voice", { sentence: "dentista", corrections });
      expect(res.status).toBe(400);
    }
    expect(prompts).toHaveLength(0);
  });
});

describe("Voice Entry: dictation", () => {
  const realSpeech = speech.run;
  let heard: { audio: string; language: string }[] = [];
  let spoken: () => Promise<{ text?: unknown }>;
  beforeEach(() => {
    heard = [];
    spoken = async () => ({ text: " Dentista na terça às três " });
    speech.run = async (_env, input) => {
      heard.push(input);
      return spoken();
    };
  });
  afterEach(() => {
    speech.run = realSpeech;
  });

  it("sends the recording to Workers AI in the asked language and returns the text", async () => {
    const browser = await setUpFamily();
    const res = await browser.upload(
      "/voice/transcribe?language=pt-PT",
      new Uint8Array([1, 2, 3]),
      "audio/webm",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Dentista na terça às três" });
    expect(heard).toEqual([{ audio: "AQID", language: "pt" }]);
  });

  it("answers null on silence, and the model's reason when it fails", async () => {
    const browser = await setUpFamily();
    spoken = async () => ({ text: "  " });
    const quiet = await browser.upload("/voice/transcribe", new Uint8Array([1]), "audio/mp4");
    expect(await quiet.json()).toEqual({ text: null });
    spoken = async () => {
      throw new Error("5006: bad audio");
    };
    const failed = await browser.upload("/voice/transcribe", new Uint8Array([1]), "audio/mp4");
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "speech model: 5006: bad audio" });
  });

  it("refuses an empty or too long recording, and a browser that isn't signed in", async () => {
    const browser = await setUpFamily();
    const empty = await browser.upload("/voice/transcribe", new Uint8Array(), "audio/webm");
    expect(empty.status).toBe(400);
    const long = await browser.upload(
      "/voice/transcribe",
      new Uint8Array(MAX_RECORDING + 1),
      "audio/webm",
    );
    expect(long.status).toBe(413);
    const stranger = await new TestBrowser().upload(
      "/voice/transcribe",
      new Uint8Array([1]),
      "audio/webm",
    );
    expect(stranger.status).toBe(401);
    expect(heard).toHaveLength(0);
  });
});
