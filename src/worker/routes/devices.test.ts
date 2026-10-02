import { describe, expect, it } from "vitest";
import { PASSWORD, TestBrowser, setUpFamily } from "../test/client";

async function signIn(ip: string, userAgent?: string) {
  const browser = new TestBrowser(ip, userAgent);
  await browser.post("/session", { password: PASSWORD });
  return browser;
}

type DeviceRow = { id: string; name: string; lastUsedAt: string; current: boolean };

describe("Signed-in devices", () => {
  it("lists each device with its name, last use and which one is this", async () => {
    const laptop = await setUpFamily();
    await signIn(
      "203.0.113.2",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
    );
    const devices = (await (await laptop.get("/devices")).json()) as DeviceRow[];
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.name).sort()).toEqual(["Chrome on Android", "Safari on iPhone"]);
    expect(devices.filter((d) => d.current)).toHaveLength(1);
    expect(devices[0].lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("renames a device", async () => {
    const laptop = await setUpFamily();
    const [me] = (await (await laptop.get("/devices")).json()) as DeviceRow[];
    expect(
      (await laptop.request("PATCH", `/devices/${me.id}`, { name: "Kitchen tablet" })).status,
    ).toBe(200);
    const [renamed] = (await (await laptop.get("/devices")).json()) as DeviceRow[];
    expect(renamed.name).toBe("Kitchen tablet");
  });

  it("signs out one device without disturbing the others", async () => {
    const laptop = await setUpFamily();
    const phone = await signIn("203.0.113.2");
    const devices = (await (await laptop.get("/devices")).json()) as DeviceRow[];
    const phoneRow = devices.find((d) => !d.current)!;

    expect((await laptop.delete(`/devices/${phoneRow.id}`)).status).toBe(204);
    expect((await phone.get("/device")).status).toBe(401);
    expect((await laptop.get("/device")).status).toBe(200);
  });
});

describe("changing the Family Password", () => {
  it("needs the current password", async () => {
    const laptop = await setUpFamily();
    const res = await laptop.post("/password", {
      currentPassword: "not the password",
      newPassword: "a brand new phrase",
    });
    expect(res.status).toBe(401);
  });

  it("needs at least 10 characters", async () => {
    const laptop = await setUpFamily();
    const res = await laptop.post("/password", { currentPassword: PASSWORD, newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("signs out every device and only the new password works", async () => {
    const laptop = await setUpFamily();
    const phone = await signIn("203.0.113.2");
    const res = await laptop.post("/password", {
      currentPassword: PASSWORD,
      newPassword: "a brand new phrase",
    });
    expect(res.status).toBe(204);
    expect((await laptop.get("/device")).status).toBe(401);
    expect((await phone.get("/device")).status).toBe(401);

    const fresh = new TestBrowser("203.0.113.3");
    expect((await fresh.post("/session", { password: PASSWORD })).status).toBe(401);
    expect((await fresh.post("/session", { password: "a brand new phrase" })).status).toBe(201);
  });
});
