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
