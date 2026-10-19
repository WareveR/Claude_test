import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mailer, type Email } from "../email";
import { addAccount, EMAIL, setUpFamily, TestBrowser } from "../test/client";

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

type Member = { id: string; email: string; role: string; dev: boolean; pending: boolean };

async function invite(browser: TestBrowser, body: Record<string, unknown> = {}) {
  const res = await browser.post("/members", {
    email: "carla@example.com",
    role: "member",
    ...body,
  });
  return { res, member: (await res.json()) as Member & { emailSent: boolean } };
}

describe("members", () => {
  it("invites an adult by email, who chooses a password and signs in", async () => {
    const owner = await setUpFamily();
    const { res, member } = await invite(owner, { email: " Carla@Example.com " });
    expect(res.status).toBe(201);
    expect(member).toMatchObject({ email: "carla@example.com", pending: true, emailSent: true });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("carla@example.com");
    expect(outbox[0].subject).toBe("Convite para o calendário da família Pires");
    expect(outbox[0].text).toContain("https://calendar.example/invite?token=");

    // Before accepting, there is no password to sign in with.
    const stranger = new TestBrowser("203.0.113.70");
    expect(
      (await stranger.post("/session", { email: "carla@example.com", password: "" })).status,
    ).toBe(401);

    const carla = new TestBrowser("203.0.113.71");
    const token = tokenIn(outbox[0]);
    expect((await carla.post("/invite/accept", { token, password: "short" })).status).toBe(400);
    expect((await carla.post("/invite/accept", { token, password: "a fine phrase" })).status).toBe(
      201,
    );
    const status = (await (await carla.get("/status")).json()) as {
      account: { email: string; role: string };
    };
    expect(status.account).toMatchObject({ email: "carla@example.com", role: "member" });
    expect((await carla.post("/invite/accept", { token, password: "a fine phrase" })).status).toBe(
      410,
    );

    const list = (await (await owner.get("/members")).json()) as Member[];
    expect(list.map((m) => [m.email, m.role, m.pending])).toEqual([
      [EMAIL, "owner", false],
      ["carla@example.com", "member", false],
    ]);
  });

  it("refuses a taken email, a bad role and an owner invite", async () => {
    const owner = await setUpFamily();
    expect((await invite(owner, { email: EMAIL })).res.status).toBe(409);
    expect((await invite(owner, { role: "owner" })).res.status).toBe(400);
    expect((await invite(owner, { email: "nope" })).res.status).toBe(400);
    expect((await invite(owner, { personId: "missing" })).res.status).toBe(400);
  });

  it("gives each Person at most one Account", async () => {
    const owner = await setUpFamily();
    const carla = (await (
      await owner.post("/persons", { name: "Carla", color: "#e07a5f" })
    ).json()) as {
      id: string;
    };
    expect((await invite(owner, { personId: carla.id })).res.status).toBe(201);
    expect(
      (await invite(owner, { email: "other@example.com", personId: carla.id })).res.status,
    ).toBe(409);
  });

  it("is only for the Owner and Admins", async () => {
    await setUpFamily();
    const member = await addAccount("rui@example.com", "member");
    expect((await member.get("/members")).status).toBe(403);
    expect((await invite(member)).res.status).toBe(403);
    const admin = await addAccount("ana@example.com", "admin", "198.51.100.21");
    expect((await admin.get("/members")).status).toBe(200);
    expect((await invite(admin)).res.status).toBe(201);
  });

  it("changes role and Dev, but never the Owner's, nor one's own role", async () => {
    const owner = await setUpFamily();
    const admin = await addAccount("ana@example.com", "admin");
    const list = (await (await owner.get("/members")).json()) as Member[];
    const ownerId = list.find((m) => m.role === "owner")!.id;
    const anaId = list.find((m) => m.email === "ana@example.com")!.id;

    expect((await admin.request("PATCH", `/members/${ownerId}`, { dev: false })).status).toBe(403);
    expect((await admin.request("PATCH", `/members/${anaId}`, { role: "member" })).status).toBe(
      403,
    );
    expect((await owner.request("PATCH", `/members/${ownerId}`, { role: "admin" })).status).toBe(
      403,
    );
    const changed = await owner.request("PATCH", `/members/${anaId}`, {
      role: "member",
      dev: true,
    });
    expect(await changed.json()).toMatchObject({ role: "member", dev: true });
    // Now a Member, Ana can't manage anyone.
    expect((await admin.get("/members")).status).toBe(403);
  });

  it("changes only a pending invite's email, and sends the invite again", async () => {
    const owner = await setUpFamily();
    const { member } = await invite(owner);
    const res = await owner.request("PATCH", `/members/${member.id}`, {
      email: "carla.p@example.com",
    });
    expect(await res.json()).toMatchObject({ email: "carla.p@example.com", emailSent: true });
    expect(outbox.at(-1)!.to).toBe("carla.p@example.com");
    // The first link no longer works.
    const carla = new TestBrowser("203.0.113.72");
    expect(
      (await carla.post("/invite/accept", { token: tokenIn(outbox[0]), password: "a fine phrase" }))
        .status,
    ).toBe(410);

    await addAccount("ana@example.com", "member");
    const ana = ((await (await owner.get("/members")).json()) as Member[]).find(
      (m) => m.email === "ana@example.com",
    )!;
    expect(
      (await owner.request("PATCH", `/members/${ana.id}`, { email: "mine@example.com" })).status,
    ).toBe(403);
  });

  it("sends a reset link, or the invite again while pending", async () => {
    const owner = await setUpFamily();
    const { member } = await invite(owner);
    expect((await owner.post(`/members/${member.id}/reset`)).status).toBe(204);
    expect(outbox.at(-1)!.text).toContain("/invite?token=");

    await addAccount("ana@example.com", "member");
    const ana = ((await (await owner.get("/members")).json()) as Member[]).find(
      (m) => m.email === "ana@example.com",
    )!;
    expect((await owner.post(`/members/${ana.id}/reset`)).status).toBe(204);
    expect(outbox.at(-1)!.to).toBe("ana@example.com");
    expect(outbox.at(-1)!.text).toContain("/recover?token=");
  });

  it("removes an adult and signs out their devices, but not the Owner or oneself", async () => {
    const owner = await setUpFamily();
    const admin = await addAccount("ana@example.com", "admin");
    const rui = await addAccount("rui@example.com", "member", "198.51.100.22");
    const list = (await (await owner.get("/members")).json()) as Member[];
    const id = (email: string) => list.find((m) => m.email === email)!.id;

    expect((await admin.delete(`/members/${id(EMAIL)}`)).status).toBe(403);
    expect((await admin.delete(`/members/${id("ana@example.com")}`)).status).toBe(403);
    expect((await admin.delete(`/members/${id("rui@example.com")}`)).status).toBe(204);
    expect((await rui.get("/persons")).status).toBe(401);
  });

  it("hands the Family to another adult, and the old Owner becomes an Admin", async () => {
    const owner = await setUpFamily();
    const ana = await addAccount("ana@example.com", "admin");
    const { member } = await invite(owner);
    const list = (await (await owner.get("/members")).json()) as Member[];
    const anaId = list.find((m) => m.email === "ana@example.com")!.id;

    expect((await ana.post(`/members/${anaId}/owner`)).status).toBe(403);
    expect((await owner.post(`/members/${member.id}/owner`)).status).toBe(400);
    expect((await owner.post(`/members/${anaId}/owner`)).status).toBe(204);
    const roles = ((await (await ana.get("/members")).json()) as Member[]).map((m) => [
      m.email,
      m.role,
    ]);
    expect(roles).toContainEqual([EMAIL, "admin"]);
    expect(roles).toContainEqual(["ana@example.com", "owner"]);
  });

  it("lets only the Owner and Admins change the Family settings", async () => {
    await setUpFamily();
    const member = await addAccount("rui@example.com", "member");
    const sleep = { sleepHours: { start: 22, end: 6 } };
    expect((await member.request("PUT", "/family/sleep", sleep)).status).toBe(403);
    expect((await member.get("/errors")).status).toBe(403);
  });
});
