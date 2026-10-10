import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { model } from "../ai";
import { setUpFamily } from "../test/client";

type Prompt = { messages: { role: string; content: string }[] };
let prompts: Prompt[] = [];
let answer: unknown;
const realRun = model.run;

beforeEach(() => {
  prompts = [];
  model.run = async (_env, input) => {
    prompts.push(input as Prompt);
    if (answer instanceof Error) throw answer;
    return { response: answer };
  };
});
afterEach(() => {
  model.run = realRun;
});

describe("Suggestions: reading the box", () => {
  it("sends only the numbered phrases and returns checked drafts, saving nothing", async () => {
    const browser = await setUpFamily();
    answer = JSON.stringify({
      items: [
        {
          kind: "entry",
          title: "Ginásio",
          date: null,
          time: "19:00",
          repeat: { frequency: "weekly", interval: 1, weekdays: [0, 2] },
        },
        { kind: "task", title: "", date: null, time: null, repeat: null },
      ],
    });
    const res = await browser.post("/suggestions/read", {
      phrases: ["ginásio 2a e 4a às 19h", "bebé"],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcome: string; items: { title: string }[] };
    expect(body.outcome).toBe("read");
    expect(body.items.map((i) => i.title)).toEqual(["Ginásio"]);
    expect(prompts[0].messages[1].content).toContain("1. ginásio 2a e 4a às 19h\n2. bebé");
    const tasks = (await (await browser.get("/tasks")).json()) as unknown[];
    expect(tasks).toHaveLength(0);
  });

  it("says it failed when the model fails, and refuses an empty box", async () => {
    const browser = await setUpFamily();
    answer = new Error("down");
    const res = await browser.post("/suggestions/read", { phrases: ["carro"] });
    expect(await res.json()).toEqual({ outcome: "failed" });
    expect((await browser.post("/suggestions/read", { phrases: [] })).status).toBe(400);
    expect((await browser.post("/suggestions/read", { phrases: ["x".repeat(1001)] })).status).toBe(
      400,
    );
  });
});
