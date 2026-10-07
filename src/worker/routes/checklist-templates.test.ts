import { describe, expect, it } from "vitest";
import { BUILT_IN_TEMPLATES } from "../../core/checklist-template";
import { setUpFamily, type TestBrowser } from "../test/client";

type Template = {
  id: string;
  builtinKey: string | null;
  name: string | null;
  items: string[] | null;
};

async function templates(browser: TestBrowser) {
  return (await (await browser.get("/checklist-templates")).json()) as Template[];
}

describe("Checklist templates", () => {
  it("gives a new Family the built-in templates, translated until edited", async () => {
    const browser = await setUpFamily();
    const list = await templates(browser);
    expect(list.map((t) => t.builtinKey)).toEqual([...BUILT_IN_TEMPLATES]);
    expect(list.every((t) => t.name === null && t.items === null)).toBe(true);
  });

  it("creates, edits and deletes a template of the Family's own", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/checklist-templates", {
      name: " Picnic ",
      items: ["Blanket", " ", " Sandwiches "],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as Template;
    expect(created).toMatchObject({
      builtinKey: null,
      name: "Picnic",
      items: ["Blanket", "Sandwiches"],
    });
    const edited = await browser.request("PUT", `/checklist-templates/${created.id}`, {
      name: "Beach picnic",
      items: ["Sandwiches", "Blanket", "Umbrella"],
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      name: "Beach picnic",
      items: ["Sandwiches", "Blanket", "Umbrella"],
    });
    expect((await templates(browser)).at(-1)?.name).toBe("Beach picnic");
    expect((await browser.delete(`/checklist-templates/${created.id}`)).status).toBe(204);
    expect((await templates(browser)).some((t) => t.id === created.id)).toBe(false);
    expect((await browser.delete(`/checklist-templates/${created.id}`)).status).toBe(404);
  });

  it("needs a name for a template of the Family's own, and a list of item names", async () => {
    const browser = await setUpFamily();
    expect((await browser.post("/checklist-templates", { name: " ", items: [] })).status).toBe(400);
    expect((await browser.post("/checklist-templates", { name: "X", items: "a" })).status).toBe(
      400,
    );
    const [builtIn] = await templates(browser);
    const kept = await browser.request("PUT", `/checklist-templates/${builtIn.id}`, {
      name: null,
      items: ["Only this"],
    });
    expect(await kept.json()).toMatchObject({ name: null, items: ["Only this"] });
  });

  it("restores defaults: brings back deleted built-ins, resets edited ones, keeps custom", async () => {
    const browser = await setUpFamily();
    const [summer, decluttering] = await templates(browser);
    await browser.request("PUT", `/checklist-templates/${summer.id}`, {
      name: "Verão",
      items: ["Janelas"],
    });
    await browser.delete(`/checklist-templates/${decluttering.id}`);
    await browser.post("/checklist-templates", { name: "Picnic", items: ["Blanket"] });
    const res = await browser.post("/checklist-templates/restore-defaults");
    expect(res.status).toBe(200);
    const list = (await res.json()) as Template[];
    expect(list.map((t) => t.builtinKey)).toEqual([...BUILT_IN_TEMPLATES, null]);
    expect(list.find((t) => t.id === summer.id)).toMatchObject({ name: null, items: null });
    expect(list.at(-1)).toMatchObject({ name: "Picnic", items: ["Blanket"] });
  });

  it("starts a Checklist with a template's items, in order, for its Persons", async () => {
    const browser = await setUpFamily();
    const ana = (await (
      await browser.post("/persons", { name: "Ana", color: "#e07a5f" })
    ).json()) as { id: string };
    const res = await browser.post("/checklists", {
      name: "Compras",
      personIds: [ana.id],
      items: ["Pão", "Leite", "Ovos"],
    });
    expect(res.status).toBe(201);
    const checklist = (await res.json()) as { id: string };
    const tasks = (await (await browser.get("/tasks")).json()) as {
      title: string;
      checklistId: string;
      personIds: string[];
      createdAt: string;
    }[];
    const items = tasks
      .filter((t) => t.checklistId === checklist.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(items.map((t) => t.title)).toEqual(["Pão", "Leite", "Ovos"]);
    expect(items.every((t) => t.personIds.join() === ana.id)).toBe(true);
  });

  it("is in the full Export", async () => {
    const browser = await setUpFamily();
    const data = (await (await browser.get("/export")).json()) as {
      tables: Record<string, unknown[]>;
    };
    expect(data.tables.checklist_template).toHaveLength(BUILT_IN_TEMPLATES.length);
  });
});
