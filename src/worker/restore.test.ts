import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { restoreSql } from "../core/restore-sql";
import { snapshot } from "./backup";
import { EMAIL, PASSWORD, setUpFamily } from "./test/client";

/** Runs restore SQL the way `wrangler d1 execute --file` does: every statement, in order. */
async function execute(sql: string) {
  const statements = sql.trim().split("\n");
  await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
}

describe("restore", () => {
  it("brings back the whole database from a nightly Backup", async () => {
    const browser = await setUpFamily();
    const ana = (await (
      await browser.post("/persons", { name: "Ana O'Neill", color: "#e07a5f" })
    ).json()) as { id: string };
    await browser.post("/tasks", { title: "Comprar pão; leite", personIds: [ana.id] });
    const backup = await snapshot(env.DB, new Date());

    // A mistaken delete, then a Person added afterwards.
    await browser.delete(
      `/tasks/${((await (await browser.get("/tasks")).json()) as { id: string }[])[0].id}`,
    );
    await browser.post("/persons", { name: "Rui", color: "#3d405b" });

    await execute(restoreSql(JSON.parse(JSON.stringify(backup))));
    // Signed-in Devices are not in the Backup, and the restore's Account rows cascade to them:
    // the device must sign in again.
    expect((await browser.get("/persons")).status).toBe(401);
    expect((await browser.post("/session", { email: EMAIL, password: PASSWORD })).status).toBe(201);
    const persons = (await (await browser.get("/persons")).json()) as { name: string }[];
    expect(persons.map((p) => p.name)).toEqual(["Ana O'Neill"]);
    const tasks = (await (await browser.get("/tasks")).json()) as {
      title: string;
      personIds: string[];
    }[];
    expect(tasks).toMatchObject([{ title: "Comprar pão; leite", personIds: [ana.id] }]);
  });

  it("writes NULL, numbers and quoted text", () => {
    expect(restoreSql({ tables: { t: [{ a: null, b: 2, c: "it's", d: true }] } })).toBe(
      'PRAGMA defer_foreign_keys = true;\nDELETE FROM "t";\nINSERT INTO "t" ("a", "b", "c", "d") VALUES (NULL, 2, \'it\'\'s\', 1);\n',
    );
  });
});
