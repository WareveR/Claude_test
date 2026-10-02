import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = "http://localhost:4173";

test("the last loaded calendar is readable offline", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Offline bread");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText("Offline bread")).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate<string | undefined>(
        "navigator.serviceWorker.ready.then((r) => r.active?.state)",
      ),
    )
    .toBe("activated");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("offlineCopy")))
    .toContain("Offline bread");

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByText("Offline bread")).toBeVisible();
    await expect(
      page.getByText(
        "You're offline. This is the last loaded calendar; changes need a connection.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.getByRole("link", { name: "New task" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
});

test("a revoked device wipes its offline copy", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/tasks");
  await expect(page.getByText("Offline bread")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("offlineCopy")))
    .toContain("Offline bread");

  const context2 = await browser.newContext({ locale: "en-GB", timezoneId: "Europe/Lisbon" });
  try {
    const page2 = await context2.newPage();
    await signIn(page2);
    const headers = { Origin: ORIGIN };
    const list = await page2.request.get("/api/devices");
    expect(list.ok()).toBe(true);
    const devices = (await list.json()) as { id: string; current: boolean }[];
    const others = devices.filter((d) => !d.current);
    expect(others.length).toBeGreaterThan(0);
    for (const device of others) {
      const res = await page2.request.delete(`/api/devices/${device.id}`, { headers });
      expect(res.ok()).toBe(true);
    }
  } finally {
    await context2.close();
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect
    .poll(async () => (await page.evaluate(() => localStorage.getItem("offlineCopy"))) ?? "")
    .not.toContain("Offline bread");
});
