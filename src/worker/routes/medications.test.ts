import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

type Med = { id: string; name: string; times: string[]; private: boolean };

async function family() {
  const owner = await setUpFamily();
  const bia = (
    (await (await owner.post("/persons", { name: "Bia", color: "#e07a5f" })).json()) as {
      id: string;
    }
  ).id;
  return { owner, bia };
}

const add = async (browser: TestBrowser, body: Record<string, unknown>) =>
  browser.post("/medications", {
    name: "Ben-u-ron",
    dose: "5 ml",
    times: ["20:00", "08:00"],
    startDate: "2026-11-17",
    endDate: "2026-11-19",
    ...body,
  });

const list = async (browser: TestBrowser) =>
  (await (await browser.get("/medications")).json()) as Med[];

describe("Medications", () => {
  it("are added, changed and deleted, with their doses ticked", async () => {
    const { owner, bia } = await family();
    const res = await add(owner, { personId: bia });
    expect(res.status).toBe(201);
    const med = (await res.json()) as Med;
    expect(med.times).toEqual(["08:00", "20:00"]);
    expect(med.private).toBe(true);
    expect((await add(owner, { personId: "nobody" })).status).toBe(400);

    const tick = (date: string, time: string) =>
      owner.post(`/medications/${med.id}/doses`, { date, time });
    expect((await tick("2026-11-17", "08:00")).status).toBe(204);
    expect((await tick("2026-11-17", "08:00")).status).toBe(204);
    // Not a time it is taken, nor a day of the treatment.
    expect((await tick("2026-11-17", "09:00")).status).toBe(400);
    expect((await tick("2026-11-20", "08:00")).status).toBe(400);
    const doses = async () =>
      (await (await owner.get("/medications/doses?date=2026-11-17")).json()) as {
        time: string;
      }[];
    expect((await doses()).map((d) => d.time)).toEqual(["08:00"]);
    expect(
      (await owner.delete(`/medications/${med.id}/doses?date=2026-11-17&time=08:00`)).status,
    ).toBe(204);
    expect(await doses()).toEqual([]);

    const changed = await owner.request("PUT", `/medications/${med.id}`, {
      personId: bia,
      name: "Brufen",
      times: ["12:00"],
      startDate: "2026-11-17",
      private: false,
    });
    expect(changed.status).toBe(200);
    expect(((await changed.json()) as Med).name).toBe("Brufen");
    expect((await owner.delete(`/medications/${med.id}`)).status).toBe(204);
    expect(await list(owner)).toEqual([]);
  });

  it("keep a Private one from Accounts other than its creator's and its Person's", async () => {
    const { owner, bia } = await family();
    const secret = (await (await add(owner, { personId: bia })).json()) as Med;
    const open = (await (
      await add(owner, { personId: bia, name: "Vitamina D", private: false })
    ).json()) as Med;

    const other = await addAccount("rita@example.com");
    expect((await list(other)).map((m) => m.name)).toEqual(["Vitamina D"]);
    expect(
      (
        await other.post(`/medications/${secret.id}/doses`, {
          date: "2026-11-17",
          time: "08:00",
        })
      ).status,
    ).toBe(404);
    expect(
      (await other.request("PUT", `/medications/${secret.id}`, { personId: bia })).status,
    ).toBe(404);
    expect((await other.delete(`/medications/${secret.id}`)).status).toBe(404);
    await owner.post(`/medications/${secret.id}/doses`, { date: "2026-11-17", time: "08:00" });
    expect(await (await other.get("/medications/doses?date=2026-11-17")).json()).toEqual([]);
    const exported = JSON.stringify(await (await other.get("/export")).json());
    expect(exported).not.toContain("Ben-u-ron");
    expect(exported).toContain(open.id);

    // Bia's own Account sees hers.
    const biaAccount = await addAccount("bia@example.com", "member", "198.51.100.21");
    await env.DB.prepare("UPDATE account SET person_id = ? WHERE email = ?")
      .bind(bia, "bia@example.com")
      .run();
    expect((await list(biaAccount)).map((m) => m.name).sort()).toEqual(["Ben-u-ron", "Vitamina D"]);
    expect((await owner.get("/export")).status).toBe(200);
  });
});
