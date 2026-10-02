import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { getDb, schema } from "../db";
import { mailer, type Email } from "../email";
import worker from "../index";
import { setUpFamily, TestBrowser } from "../test/client";
import type { AppEnv } from "../types";
import { unexpectedError } from "./errors";

let outbox: Email[] = [];
const realSend = mailer.send;
beforeEach(() => {
  outbox = [];
  mailer.send = async (_env, email) => {
    outbox.push(email);
  };
});
afterEach(() => {
  mailer.send = realSend;
});

const anError = (code: string, at = new Date().toISOString()) => ({
  code,
  at,
  appVersion: "abc1234",
  action: "PUT /entries/x1",
  message: "TypeError: Failed to fetch",
});

function runScheduler(at: string) {
  const controller = { scheduledTime: new Date(at).getTime(), cron: "*/5 * * * *" };
  return worker.scheduled(controller as ScheduledController, env);
}

describe("Error Log", () => {
  it("keeps device errors once, with the device's name, newest first", async () => {
    const browser = await setUpFamily();
    expect(
      (await browser.post("/errors", anError("ERR-AAAA", "2020-01-01T00:00:00Z"))).status,
    ).toBe(204);
    const now = new Date().toISOString();
    expect((await browser.post("/errors", anError("ERR-BBBB", now))).status).toBe(204);
    // Sent again after being offline: kept once.
    expect((await browser.post("/errors", anError("ERR-BBBB", now))).status).toBe(204);
    expect((await browser.post("/errors", anError("oops"))).status).toBe(400);

    const log = await (await browser.get("/errors")).json<Record<string, unknown>[]>();
    // Older than 90 days doesn't show.
    expect(log.map((e) => e.code)).toEqual(["ERR-BBBB"]);
    expect(log[0]).toMatchObject({
      source: "device",
      appVersion: "abc1234",
      action: "PUT /entries/x1",
      message: "TypeError: Failed to fetch",
      comment: null,
    });
    expect(log[0].deviceName).toEqual(expect.any(String));
  });

  it("needs a signed-in device", async () => {
    await setUpFamily();
    const stranger = new TestBrowser("203.0.113.70");
    expect((await stranger.post("/errors", anError("ERR-CCCC"))).status).toBe(401);
    expect((await stranger.get("/errors")).status).toBe(401);
  });

  it("logs unexpected Worker failures and answers with their code", async () => {
    await setUpFamily();
    const app = new Hono<AppEnv>()
      .use(async (c, next) => {
        c.set("db", getDb(env.DB));
        c.set("now", new Date());
        await next();
      })
      .get("/boom", () => {
        throw new Error("kaboom");
      })
      .onError(unexpectedError);
    const res = await app.request("/boom", {}, env);
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string; code: string }>();
    expect(body.error).toBe("server_error");
    const rows = await getDb(env.DB).select().from(schema.errorLog);
    expect(rows).toEqual([
      expect.objectContaining({
        code: body.code,
        source: "server",
        action: "GET /boom",
        message: "Error: kaboom",
      }),
    ]);
  });
});

describe("Report", () => {
  it("emails the recovery address with the details and the comment", async () => {
    const browser = await setUpFamily();
    await browser.post("/errors", anError("ERR-DDDD"));
    const res = await browser.post("/errors/ERR-DDDD/report", { comment: "Ao guardar o jantar" });
    expect(res.status).toBe(204);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("david@example.com");
    expect(outbox[0].subject).toBe("Erro reportado: ERR-DDDD");
    expect(outbox[0].text).toContain("PUT /entries/x1");
    expect(outbox[0].text).toContain("Ao guardar o jantar");
    const [row] = await (await browser.get("/errors")).json<{ comment: string }[]>();
    expect(row.comment).toBe("Ao guardar o jantar");
    expect((await browser.post("/errors/ERR-ZZZZ/report", {})).status).toBe(404);
  });

  it("sends at most five Reports an hour", async () => {
    const browser = await setUpFamily();
    const codes = ["ERR-2222", "ERR-3333", "ERR-4444", "ERR-5555", "ERR-6666", "ERR-7777"];
    for (const code of codes) await browser.post("/errors", anError(code));
    const statuses = [];
    for (const code of codes)
      statuses.push((await browser.post(`/errors/${code}/report`, {})).status);
    expect(statuses).toEqual([204, 204, 204, 204, 204, 429]);
    expect(outbox).toHaveLength(5);
  });
});

describe("daily error summary", () => {
  it("is sent once a day after 07:00 Family time, only on days with errors", async () => {
    const browser = await setUpFamily();
    // Lisbon is UTC+1 in September.
    await runScheduler("2026-09-20T05:30:00Z");
    expect(outbox).toHaveLength(0);
    await runScheduler("2026-09-20T06:05:00Z");
    expect(outbox).toHaveLength(0); // no errors yet

    await browser.post("/errors", anError("ERR-EEEE", "2026-09-20T09:00:00Z"));
    await browser.post("/errors", anError("ERR-FFFF", "2026-09-20T12:00:00Z"));
    await runScheduler("2026-09-20T18:00:00Z");
    expect(outbox).toHaveLength(0); // today's summary already went out

    await runScheduler("2026-09-21T06:00:00Z");
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe("Houve 2 erros no calendário");
    expect(outbox[0].text).toContain("ERR-EEEE");
    expect(outbox[0].text).toContain("ERR-FFFF");
    await runScheduler("2026-09-21T06:05:00Z");
    expect(outbox).toHaveLength(1);

    // Nothing new since: no email.
    await runScheduler("2026-09-22T06:00:00Z");
    expect(outbox).toHaveLength(1);
  });

  it("forgets errors older than 90 days", async () => {
    const browser = await setUpFamily();
    await browser.post("/errors", anError("ERR-GGGG", "2026-06-01T10:00:00Z"));
    await runScheduler("2026-09-20T06:30:00Z");
    const rows = await getDb(env.DB).select().from(schema.errorLog);
    expect(rows).toEqual([]);
  });
});
