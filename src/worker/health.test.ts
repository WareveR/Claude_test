import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("answers ok and reports that no Family exists yet", async () => {
    const res = await exports.default.fetch("https://example.com/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", familyExists: false });
  });

  it("reports the Family once it exists", async () => {
    await env.DB.prepare(
      "INSERT INTO family (id, name, language, time_zone, created_at, changed_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("f1", "Pires", "pt-PT", "Europe/Lisbon", "2026-10-02T07:00:00Z", "2026-10-02T07:00:00Z")
      .run();
    const res = await exports.default.fetch("https://example.com/api/health");
    expect(await res.json()).toEqual({ status: "ok", familyExists: true });
  });
});
