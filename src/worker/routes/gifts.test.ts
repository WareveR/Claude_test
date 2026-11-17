import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

type Gift = { id: string; text: string; personId: string; givenOn: string | null };

async function family() {
  const owner = await setUpFamily();
  const person = async (name: string) =>
    ((await (await owner.post("/persons", { name, color: "#e07a5f" })).json()) as { id: string })
      .id;
  const bia = await person("Bia");
  const rui = await person("Rui");
  const biaAccount = await addAccount("bia@example.com", "member", "198.51.100.21");
  await env.DB.prepare("UPDATE account SET person_id = ? WHERE email = ?")
    .bind(bia, "bia@example.com")
    .run();
  return { owner, bia, rui, biaAccount };
}

const list = async (browser: TestBrowser) => (await (await browser.get("/gifts")).json()) as Gift[];

describe("Gift Ideas", () => {
  it("are noted, changed, given and deleted", async () => {
    const { owner, bia } = await family();
    const res = await owner.post("/gifts", { personId: bia, text: "Lego", occasion: "christmas" });
    expect(res.status).toBe(201);
    const gift = (await res.json()) as Gift;
    expect((await owner.post("/gifts", { personId: "nobody", text: "x" })).status).toBe(400);
    const given = await owner.request("PUT", `/gifts/${gift.id}`, {
      personId: bia,
      text: "Lego City",
      occasion: "christmas",
      givenOn: "2026-12-25",
    });
    expect(((await given.json()) as Gift).givenOn).toBe("2026-12-25");
    expect((await list(owner)).map((g) => g.text)).toEqual(["Lego City"]);
    expect((await owner.delete(`/gifts/${gift.id}`)).status).toBe(204);
    expect(await list(owner)).toEqual([]);
  });

  it("are never seen by the Person they are for, nor added by them for themselves", async () => {
    const { owner, bia, rui, biaAccount } = await family();
    const forBia = (await (
      await owner.post("/gifts", { personId: bia, text: "Bicicleta" })
    ).json()) as Gift;
    await owner.post("/gifts", { personId: rui, text: "Livro" });

    expect((await list(biaAccount)).map((g) => g.text)).toEqual(["Livro"]);
    expect(
      (await biaAccount.request("PUT", `/gifts/${forBia.id}`, { personId: bia, text: "x" })).status,
    ).toBe(404);
    expect((await biaAccount.delete(`/gifts/${forBia.id}`)).status).toBe(404);
    expect((await biaAccount.post("/gifts", { personId: bia, text: "Pónei" })).status).toBe(400);
    // Nor can she move one of hers onto herself.
    const livro = (await list(biaAccount))[0];
    expect(
      (await biaAccount.request("PUT", `/gifts/${livro.id}`, { personId: bia, text: "x" })).status,
    ).toBe(400);

    const exported = JSON.stringify(await (await biaAccount.get("/export")).json());
    expect(exported).not.toContain("Bicicleta");
    expect(exported).toContain("Livro");
    expect(JSON.stringify(await (await owner.get("/export")).json())).toContain("Bicicleta");
  });
});
