import { describe, expect, it } from "vitest";
import { setUpFamily, TestBrowser } from "../test/client";

type Item = {
  id: string;
  name: string;
  quantity: string;
  note: string;
  store: string;
  boughtAt: string | null;
};
type History = {
  suggestions: { name: string; count: number; store: string }[];
  stores: string[];
  bought: Item[];
};

const items = async (browser: TestBrowser) =>
  (await (await browser.get("/shopping/items")).json()) as Item[];

describe("Shopping List", () => {
  it("adds, changes, ticks bought, unticks and deletes an item", async () => {
    const browser = await setUpFamily();
    const created = await browser.post("/shopping/items", {
      name: " Leite ",
      quantity: "6",
      store: "Lidl",
    });
    expect(created.status).toBe(201);
    const leite = (await created.json()) as Item;
    expect(leite).toMatchObject({ name: "Leite", quantity: "6", note: "", store: "Lidl" });
    expect(leite.boughtAt).toBeNull();

    const changed = await browser.request("PATCH", `/shopping/items/${leite.id}`, {
      note: "meio-gordo",
      store: "",
    });
    expect(await changed.json()).toMatchObject({ note: "meio-gordo", store: "", quantity: "6" });

    const bought = (await (
      await browser.request("PATCH", `/shopping/items/${leite.id}`, { bought: true })
    ).json()) as Item;
    expect(bought.boughtAt).not.toBeNull();
    // Ticking again keeps the first time; a bought item still comes back on its day.
    const again = (await (
      await browser.request("PATCH", `/shopping/items/${leite.id}`, { bought: true })
    ).json()) as Item;
    expect(again.boughtAt).toBe(bought.boughtAt);
    expect((await items(browser)).map((i) => i.id)).toEqual([leite.id]);

    const unticked = (await (
      await browser.request("PATCH", `/shopping/items/${leite.id}`, { bought: false })
    ).json()) as Item;
    expect(unticked.boughtAt).toBeNull();

    expect((await browser.delete(`/shopping/items/${leite.id}`)).status).toBe(204);
    expect(await items(browser)).toEqual([]);
    expect((await browser.delete(`/shopping/items/${leite.id}`)).status).toBe(404);
  });

  it("takes an id chosen by the device, once", async () => {
    const browser = await setUpFamily();
    const id = "device-chosen-id-1";
    expect((await browser.post("/shopping/items", { id, name: "Pão" })).status).toBe(201);
    expect((await browser.post("/shopping/items", { id, name: "Pão" })).status).toBe(409);
    expect((await browser.post("/shopping/items", { id: "x", name: "Pão" })).status).toBe(400);
  });

  it("refuses an item without a name or with text that isn't text", async () => {
    const browser = await setUpFamily();
    expect((await browser.post("/shopping/items", { name: "  " })).status).toBe(400);
    expect((await browser.post("/shopping/items", { name: "Ovos", store: 3 })).status).toBe(400);
    const ovos = (await (await browser.post("/shopping/items", { name: "Ovos" })).json()) as Item;
    expect(
      (await browser.request("PATCH", `/shopping/items/${ovos.id}`, { name: "" })).status,
    ).toBe(400);
    expect(
      (await browser.request("PATCH", `/shopping/items/${ovos.id}`, { bought: "yes" })).status,
    ).toBe(400);
    expect((await browser.request("PATCH", "/shopping/items/nope", { note: "x" })).status).toBe(
      404,
    );
  });

  it("suggests names from the history, most often first, with their latest shop", async () => {
    const browser = await setUpFamily();
    for (const [name, store] of [
      ["Café", "Continente"],
      ["Pão", ""],
      ["cafe", "Lidl"],
    ]) {
      const item = (await (await browser.post("/shopping/items", { name, store })).json()) as Item;
      await browser.request("PATCH", `/shopping/items/${item.id}`, { bought: true });
    }
    const history = (await (await browser.get("/shopping/history")).json()) as History;
    expect(history.suggestions.map((s) => [s.name, s.count, s.store])).toEqual([
      ["cafe", 2, "Lidl"],
      ["Pão", 1, ""],
    ]);
    expect(history.stores.sort()).toEqual(["Continente", "Lidl"]);
    expect(history.bought.map((i) => i.name)).toHaveLength(3);
  });

  it("needs a signed-in device", async () => {
    expect((await new TestBrowser().get("/shopping/items")).status).toBe(401);
  });
});
