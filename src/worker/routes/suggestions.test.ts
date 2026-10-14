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
  it("sends the numbered phrases and returns checked drafts, saving nothing", async () => {
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

  it("tells the model the Persons and their nicknames, and returns whom each item is for", async () => {
    const browser = await setUpFamily();
    const rui = (await (
      await browser.post("/persons", { name: "Rui", color: "#bbdefb", nicknames: ["pai"] })
    ).json()) as { id: string };
    const old = (await (
      await browser.post("/persons", { name: "Avó", color: "#bbdefb" })
    ).json()) as {
      id: string;
    };
    await browser.request("PATCH", `/persons/${old.id}`, { archived: true });
    answer = JSON.stringify({
      items: [
        { kind: "entry", title: "Ginásio", date: null, time: "19:00", repeat: null, persons: [0] },
      ],
    });
    const res = await browser.post("/suggestions/read", { phrases: ["ginásio do pai às 19h"] });
    const body = (await res.json()) as { items: { personIds: string[] }[] };
    expect(body.items[0].personIds).toEqual([rui.id]);
    const content = prompts[0].messages[1].content;
    expect(content).toContain("0. Rui (also called pai)");
    expect(content).not.toContain("Avó");
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
