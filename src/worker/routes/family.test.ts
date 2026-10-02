import { describe, expect, it } from "vitest";
import { setUpFamily, TestBrowser } from "../test/client";

describe("Public Holiday places", () => {
  it("start with Portugal and can be changed by any signed-in device", async () => {
    const browser = await setUpFamily();
    const status = (await (await browser.get("/status")).json()) as {
      family: { holidayPlaces: unknown };
    };
    expect(status.family.holidayPlaces).toEqual([{ country: "PT" }]);

    const places = [{ country: "PT" }, { country: "ES", state: "GA" }];
    const res = await browser.request("PUT", "/family/holidays", { places });
    expect(res.status).toBe(200);
    const after = (await (await browser.get("/status")).json()) as {
      family: { holidayPlaces: unknown };
    };
    expect(after.family.holidayPlaces).toEqual(places);
  });

  it("refuses malformed places and strangers", async () => {
    const browser = await setUpFamily();
    const bad = await browser.request("PUT", "/family/holidays", { places: [{ country: "pt" }] });
    expect(bad.status).toBe(400);
    const stranger = await new TestBrowser("192.0.2.7").request("PUT", "/family/holidays", {
      places: [],
    });
    expect(stranger.status).toBe(401);
  });
});
