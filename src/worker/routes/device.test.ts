import { describe, expect, it } from "vitest";
import { setUpFamily } from "../test/client";

describe("the device's language", () => {
  it("starts unset and can be chosen per device", async () => {
    const browser = await setUpFamily();
    expect(await (await browser.get("/status")).json()).toMatchObject({
      device: { language: null },
    });

    const res = await browser.request("PATCH", "/device", { language: "en" });
    expect(res.status).toBe(200);
    expect(await (await browser.get("/status")).json()).toMatchObject({
      device: { language: "en" },
    });
  });

  it("accepts only the v1 languages", async () => {
    const browser = await setUpFamily();
    const res = await browser.request("PATCH", "/device", { language: "fr" });
    expect(res.status).toBe(400);
  });

  it("keeps the kind and model the device finds itself to be", async () => {
    const browser = await setUpFamily();
    const res = await browser.request("PATCH", "/device", {
      kind: "tablet",
      model: "SM-X710\u0007",
    });
    expect(res.status).toBe(200);
    expect(await (await browser.get("/status")).json()).toMatchObject({
      device: { kind: "tablet", model: "SM-X710" },
    });
    expect((await browser.request("PATCH", "/device", { kind: "toaster" })).status).toBe(400);
    expect((await browser.request("PATCH", "/device", {})).status).toBe(400);
  });
});
