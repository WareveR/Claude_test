import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PASSWORD, TestBrowser, VALID_SETUP, setUpFamily } from "../test/client";

describe("first-run setup", () => {
  it("creates the Family, signs the device in and locks itself", async () => {
    const browser = new TestBrowser();
    expect(await (await browser.get("/status")).json()).toMatchObject({
      familyExists: false,
      signedIn: false,
    });

    const res = await browser.post("/setup", VALID_SETUP);
    expect(res.status).toBe(201);
    expect(await (await browser.get("/status")).json()).toMatchObject({
      familyExists: true,
      signedIn: true,
      family: { name: "Pires", language: "pt-PT", timeZone: "Europe/Lisbon" },
      device: { name: "Chrome on Android", language: null },
    });

    const again = await new TestBrowser("192.0.2.5").post("/setup", VALID_SETUP);
    expect(again.status).toBe(409);
  });

  it("refuses a wrong setup code", async () => {
    const res = await new TestBrowser().post("/setup", { ...VALID_SETUP, setupCode: "guess" });
    expect(res.status).toBe(401);
    expect((await new TestBrowser().get("/status").then((r) => r.json())) as object).toMatchObject({
      familyExists: false,
    });
  });

  it("needs a password of at least 10 characters and nothing else", async () => {
    const short = await new TestBrowser().post("/setup", { ...VALID_SETUP, password: "123456789" });
    expect(short.status).toBe(400);
    const plain = await new TestBrowser().post("/setup", {
      ...VALID_SETUP,
      password: "aaaaaaaaaa",
    });
    expect(plain.status).toBe(201);
  });

  it("checks the language and time zone", async () => {
    expect(
      (await new TestBrowser().post("/setup", { ...VALID_SETUP, language: "fr" })).status,
    ).toBe(400);
    expect(
      (await new TestBrowser().post("/setup", { ...VALID_SETUP, timeZone: "Mars/Olympus" })).status,
    ).toBe(400);
  });

  it("stores the password only as a PBKDF2 hash", async () => {
    await setUpFamily();
    const row = await env.DB.prepare("SELECT password_hash FROM family").first<{
      password_hash: string;
    }>();
    expect(row?.password_hash).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(row?.password_hash).not.toContain(PASSWORD);
  });
});

describe("sign-in", () => {
  it("signs a device in with the Family Password", async () => {
    await setUpFamily();
    const phone = new TestBrowser();
    expect((await phone.get("/device")).status).toBe(401);

    const res = await phone.post("/session", { password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.headers.get("Set-Cookie")).toMatch(
      /^__Host-session=[^;]+; Max-Age=31536000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
    );
    expect(await (await phone.get("/device")).json()).toMatchObject({ name: "Chrome on Android" });
  });

  it("stores only the session's hash", async () => {
    await setUpFamily();
    const phone = new TestBrowser();
    await phone.post("/session", { password: PASSWORD });
    const token = phone.cookie.split("=")[1];
    const rows = await env.DB.prepare("SELECT session_hash FROM signed_in_device").all<{
      session_hash: string;
    }>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results.map((r) => r.session_hash)).not.toContain(token);
  });

  it("refuses a wrong password", async () => {
    await setUpFamily();
    const res = await new TestBrowser().post("/session", { password: "wrong password" });
    expect(res.status).toBe(401);
  });

  it("slows down after 5 wrong attempts", async () => {
    await setUpFamily();
    const guesser = new TestBrowser("203.0.113.66");
    for (let i = 0; i < 5; i++) {
      expect((await guesser.post("/session", { password: `wrong ${i}` })).status).toBe(401);
    }
    const blocked = await guesser.post("/session", { password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ retryAfter: 1 });
  });

  it("counts wrong attempts for the whole Family too", async () => {
    await setUpFamily();
    for (let i = 0; i < 5; i++) {
      await new TestBrowser(`203.0.113.${100 + i}`).post("/session", { password: "wrong one" });
    }
    const other = await new TestBrowser("203.0.113.200").post("/session", { password: PASSWORD });
    expect(other.status).toBe(429);
  });

  it("ends a session after a year without use", async () => {
    await setUpFamily();
    const phone = new TestBrowser();
    await phone.post("/session", { password: PASSWORD });
    await env.DB.prepare("UPDATE signed_in_device SET last_used_at = ?")
      .bind(new Date(Date.now() - 366 * 24 * 3600 * 1000).toISOString())
      .run();
    expect((await phone.get("/device")).status).toBe(401);
  });

  it("signs out this device", async () => {
    const browser = await setUpFamily();
    const res = await browser.delete("/session");
    expect(res.status).toBe(204);
    expect((await browser.get("/device")).status).toBe(401);
  });
});

describe("request safety", () => {
  it("rejects state-changing requests from another origin", async () => {
    const res = await new TestBrowser().request("POST", "/setup", VALID_SETUP, {
      Origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
  });

  it("sends the security headers", async () => {
    const res = await new TestBrowser().get("/status");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
