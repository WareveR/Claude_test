import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mailer, type Email } from "../email";
import { PASSWORD, setUpFamily, TestBrowser, VALID_SETUP } from "../test/client";

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

const tokenIn = (email: Email) => /token=([\w-]+)/.exec(email.text)![1];

describe("password recovery", () => {
  it("emails a single-use link to the recovery address and nothing for others", async () => {
    await setUpFamily();
    const stranger = new TestBrowser("203.0.113.50");
    const wrong = await stranger.post("/recovery", { email: "someone@else.com" });
    const right = await stranger.post("/recovery", { email: "David@Example.com " });
    expect(wrong.status).toBe(202);
    expect(await wrong.json()).toEqual(await right.json());
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(VALID_SETUP.recoveryEmail);
    // Emails are in the Family Language.
    expect(outbox[0].subject).toBe("Escolher uma nova Palavra-passe da Família");
    expect(outbox[0].text).toContain("https://calendar.example/recover?token=");
  });

  it("sets a new password once, signs out every device and sends a notice", async () => {
    const browser = await setUpFamily();
    const stranger = new TestBrowser("203.0.113.51");
    await stranger.post("/recovery", { email: VALID_SETUP.recoveryEmail });
    const token = tokenIn(outbox[0]);

    const res = await stranger.post("/recovery/password", { token, password: "a fresh phrase" });
    expect(res.status).toBe(204);
    expect((await browser.get("/persons")).status).toBe(401);
    expect(outbox.at(-1)!.subject).toBe("A Palavra-passe da Família mudou");
    const again = await stranger.post("/recovery/password", { token, password: "another one!" });
    expect(again.status).toBe(410);

    expect((await stranger.post("/session", { password: PASSWORD })).status).toBe(401);
    expect((await stranger.post("/session", { password: "a fresh phrase" })).status).toBe(201);
  });

  it("expires the link after an hour", async () => {
    await setUpFamily();
    const stranger = new TestBrowser("203.0.113.52");
    await stranger.post("/recovery", { email: VALID_SETUP.recoveryEmail });
    const token = tokenIn(outbox[0]);
    await env.DB.prepare("UPDATE recovery_token SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    const res = await stranger.post("/recovery/password", { token, password: "a fresh phrase" });
    expect(res.status).toBe(410);
  });
});

describe("recovery email change", () => {
  it("needs the password and works only once the new address confirms", async () => {
    const browser = await setUpFamily();
    const wrong = await browser.post("/recovery-email", {
      password: "nope",
      email: "new@example.com",
    });
    expect(wrong.status).toBe(401);
    const res = await browser.post("/recovery-email", {
      password: PASSWORD,
      email: "new@example.com",
    });
    expect(res.status).toBe(202);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("new@example.com");

    // Not changed yet: recovery still goes to the old address.
    await browser.post("/recovery", { email: "new@example.com" });
    expect(outbox).toHaveLength(1);

    const confirm = await new TestBrowser("203.0.113.53").post("/recovery-email/confirm", {
      token: tokenIn(outbox[0]),
    });
    expect(confirm.status).toBe(204);
    expect(outbox.slice(1).map((e) => e.to)).toEqual([
      VALID_SETUP.recoveryEmail,
      "new@example.com",
    ]);
    await browser.post("/recovery", { email: "new@example.com" });
    expect(outbox.at(-1)!.to).toBe("new@example.com");
  });
});

describe("a new setup code", () => {
  it("reopens a screen that only chooses a new Family Password", async () => {
    const browser = await setUpFamily();
    const stranger = new TestBrowser("203.0.113.54");
    const locked = await stranger.post("/setup/password", {
      setupCode: VALID_SETUP.setupCode,
      password: "a fresh phrase",
    });
    expect(locked.status).toBe(409);

    // The installer sets a different setup code: the stored hash no longer matches.
    await env.DB.prepare("UPDATE family SET setup_code_hash = 'old'").run();
    const status = (await (await stranger.get("/status")).json()) as { newSetupCode: boolean };
    expect(status.newSetupCode).toBe(true);
    const wrongCode = await stranger.post("/setup/password", {
      setupCode: "guess",
      password: "a fresh phrase",
    });
    expect(wrongCode.status).toBe(401);
    const res = await stranger.post("/setup/password", {
      setupCode: VALID_SETUP.setupCode,
      password: "a fresh phrase",
    });
    expect(res.status).toBe(201);
    expect((await browser.get("/persons")).status).toBe(401);
    expect((await stranger.get("/persons")).status).toBe(200);
    const after = (await (await stranger.get("/status")).json()) as { newSetupCode: boolean };
    expect(after.newSetupCode).toBe(false);
  });
});
