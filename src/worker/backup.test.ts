import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "./db";
import worker from "./index";
import { setUpFamily } from "./test/client";

function runScheduler(at: string) {
  const controller = { scheduledTime: new Date(at).getTime(), cron: "*/5 * * * *" };
  return worker.scheduled(controller as ScheduledController, env);
}

const keys = async (prefix: string) =>
  (await env.BACKUPS.list({ prefix })).objects.map((o) => o.key).sort();

type Backup = { format: string; tables: Record<string, Record<string, unknown>[]> };

describe("nightly Backup", () => {
  it("writes the whole database once a night, after 03:00 Family time", async () => {
    const browser = await setUpFamily();
    await browser.post("/persons", { name: "Ana", color: "#e07a5f" });

    await runScheduler("2026-10-02T01:30:00Z"); // 02:30 in Lisbon
    expect(await keys("")).toEqual([]);

    await runScheduler("2026-10-02T02:05:00Z"); // 03:05 in Lisbon
    expect(await keys("")).toEqual(["monthly/2026-10.json", "nightly/2026-10-02.json"]);
    const backup = (await (await env.BACKUPS.get("nightly/2026-10-02.json"))!.json()) as Backup;
    expect(backup.format).toBe("family-calendar-backup");
    expect(backup.tables.family).toHaveLength(1);
    expect(backup.tables.person.map((p) => p.name)).toEqual(["Ana"]);
    expect(backup.tables.entry_type.length).toBeGreaterThan(0);
    expect(backup.tables).not.toHaveProperty("sign_in_throttle");
    expect(backup.tables).not.toHaveProperty("d1_migrations");

    await env.BACKUPS.delete("nightly/2026-10-02.json");
    await runScheduler("2026-10-02T02:10:00Z");
    expect(await keys("nightly/")).toEqual([]);
  });

  it("keeps 30 nightly copies and the first of each month for 12 months", async () => {
    await setUpFamily();
    for (const key of [
      "nightly/2026-08-30.json",
      "nightly/2026-09-02.json",
      "nightly/2026-09-03.json",
      "monthly/2025-10.json",
      "monthly/2025-11.json",
      "monthly/2026-10.json",
    ]) {
      await env.BACKUPS.put(key, "{}");
    }
    await runScheduler("2026-10-02T02:05:00Z");
    expect(await keys("")).toEqual([
      "monthly/2025-11.json",
      "monthly/2026-10.json",
      "nightly/2026-09-03.json",
      "nightly/2026-10-02.json",
    ]);
    // The month's first copy is never replaced.
    expect(await (await env.BACKUPS.get("monthly/2026-10.json"))!.text()).toBe("{}");
  });

  it("goes to the Error Log when it fails", async () => {
    await setUpFamily();
    const put = env.BACKUPS.put;
    env.BACKUPS.put = () => Promise.reject(new Error("R2 is down"));
    try {
      await runScheduler("2026-10-02T02:05:00Z");
    } finally {
      env.BACKUPS.put = put;
    }
    const logged = await getDb(env.DB).select().from(schema.errorLog);
    expect(logged.map((e) => e.action)).toContain("scheduler backup");
  });
});

describe("image cleanup", () => {
  it("deletes images unused for 30 days and keeps the ones still shown", async () => {
    const browser = await setUpFamily();
    const upload = async () =>
      (
        (await (
          await browser.upload("/images", new Uint8Array([1, 2, 3]), "image/png")
        ).json()) as { key: string }
      ).key;
    const photo = await upload();
    const unused = await upload();
    await browser.post("/persons", { name: "Ana", color: "#e07a5f", photoKey: photo });
    const db = getDb(env.DB);
    await db.update(schema.image).set({ lastUsedAt: "2026-08-01T00:00:00.000Z" });

    await runScheduler("2026-10-02T02:05:00Z");
    expect(await env.IMAGES.get(unused)).toBeNull();
    expect(await env.IMAGES.get(photo)).not.toBeNull();
    const rows = await db.select().from(schema.image);
    expect(rows.map((r) => r.key)).toEqual([photo]);
    expect(rows[0].lastUsedAt).toBe("2026-10-02T02:05:00.000Z");

    // Removed from the Person: kept another 30 days, then gone.
    await db.update(schema.person).set({ photoKey: null }).where(eq(schema.person.name, "Ana"));
    await runScheduler("2026-10-20T02:05:00Z");
    expect(await env.IMAGES.get(photo)).not.toBeNull();
    await runScheduler("2026-11-02T03:05:00Z");
    expect(await env.IMAGES.get(photo)).toBeNull();
  });
});
