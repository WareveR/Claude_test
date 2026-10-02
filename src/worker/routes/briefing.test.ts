import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { model } from "../ai";
import worker from "../index";
import { setUpFamily, TestBrowser } from "../test/client";

type Prompt = { messages: { role: string; content: string }[] };
type Briefing = {
  segments: { text: string; link?: { kind: string; id: string; date: string } }[];
  fallback: boolean;
  writtenAt: string;
} | null;

let prompts: Prompt[] = [];
let answer: (prompt: Prompt) => unknown;
const realRun = model.run;

beforeEach(() => {
  prompts = [];
  answer = () => ({ segments: [{ text: "A quiet week.", item: null }] });
  model.run = async (_env, input) => {
    prompts.push(input as Prompt);
    return { response: answer(input as Prompt) };
  };
});
afterEach(() => {
  model.run = realRun;
});

function runScheduler(at: Date) {
  const controller = { scheduledTime: at.getTime(), cron: "*/5 * * * *" };
  return worker.scheduled(controller as ScheduledController, env);
}

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

async function familyWithPlans() {
  const browser = await setUpFamily();
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  const typeId = types.find((t) => t.builtinKey === "appointment")!.id;
  const add = async (title: string, extra: Record<string, unknown> = {}) =>
    (
      (await (
        await browser.post("/entries", {
          title,
          entryTypeId: typeId,
          time: { allDay: true, startDate: today(), endDate: today() },
          personIds: [],
          notes: "secret notes",
          ...extra,
        })
      ).json()) as { id: string }
    ).id;
  const dentist = await add("Dentist");
  await add("Therapy", { private: true });
  return { browser, dentist };
}

describe("Briefing", () => {
  it("is never written on page load, only by Refresh or the Scheduler", async () => {
    const { browser } = await familyWithPlans();
    expect(await (await browser.get("/briefing")).json()).toBeNull();
    expect(prompts).toHaveLength(0);
  });

  it("sends only titles, dates and names, and links the phrases the model marks", async () => {
    const { browser, dentist } = await familyWithPlans();
    answer = () => ({
      segments: [
        { text: "Today there's the ", item: null },
        { text: "dentist", item: 0 },
        { text: ". Have a good day!", item: null },
      ],
    });
    const briefing = (await (await browser.post("/briefing/refresh")).json()) as Briefing;
    expect(briefing?.fallback).toBe(false);
    expect(briefing?.segments).toEqual([
      { text: "Today there's the " },
      { text: "dentist", link: { kind: "entry", id: dentist, date: today() } },
      { text: ". Have a good day!" },
    ]);
    const sent = JSON.stringify(prompts);
    expect(sent).toContain("Dentist");
    expect(sent).not.toContain("Therapy");
    expect(sent).not.toContain("secret notes");
    expect(sent).toContain("European Portuguese");
    expect(await (await browser.get("/briefing")).json()).toEqual(briefing);
  });

  it("falls back to the countdown list when the model fails or answers nonsense", async () => {
    const { browser } = await familyWithPlans();
    answer = () => ({ segments: [{ text: "Made up", item: 7 }] });
    const briefing = (await (await browser.post("/briefing/refresh")).json()) as Briefing;
    expect(briefing?.fallback).toBe(true);
    expect(briefing?.segments[0].text).toMatch(/^Dentist · hoje \(/);

    model.run = () => Promise.reject(new Error("model down"));
    const db = env.DB;
    await db.prepare("UPDATE briefing SET written_at = '2000-01-01T00:00:00.000Z'").run();
    const again = (await (await browser.post("/briefing/refresh")).json()) as Briefing;
    expect(again?.fallback).toBe(true);
  });

  it("doesn't rewrite more than once a minute on Refresh", async () => {
    const { browser } = await familyWithPlans();
    await browser.post("/briefing/refresh");
    await browser.post("/briefing/refresh");
    expect(prompts).toHaveLength(1);
  });

  it("is written once a day from 05:00 Family time", async () => {
    await familyWithPlans();
    await runScheduler(new Date("2026-10-02T03:55:00Z")); // 04:55 in Lisbon
    expect(prompts).toHaveLength(0);
    await runScheduler(new Date("2026-10-02T04:00:00Z")); // 05:00
    await runScheduler(new Date("2026-10-02T04:05:00Z"));
    expect(prompts).toHaveLength(1);
    const [row] = (await env.DB.prepare("SELECT scope, language, fallback FROM briefing").all())
      .results;
    expect(row).toEqual({ scope: "family", language: "pt-PT", fallback: 0 });
  });

  it("needs a signed-in device", async () => {
    await setUpFamily();
    expect((await new TestBrowser("192.0.2.92").get("/briefing")).status).toBe(401);
  });
});
