import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Family creates, replaces and revokes a Calendar Feed", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/calendar");
  await page.getByLabel("Feed name").fill("Work phone");
  await page.getByRole("button", { name: "Create Feed" }).click();

  const address = page.getByLabel("Feed address");
  await expect(address).toBeVisible();
  const oldUrl = await address.inputValue();
  expect(oldUrl).toMatch(/\/api\/feed\/[\w-]+\.ics$/);
  const first = await page.request.get(oldUrl);
  expect(first.status()).toBe(200);
  expect(await first.text()).toContain("BEGIN:VCALENDAR");

  await page.getByRole("button", { name: "Done" }).click();
  await expect(address).toHaveCount(0);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Replace address of Work phone" }).click();
  await expect(address).toBeVisible();
  const newUrl = await address.inputValue();
  expect(newUrl).not.toBe(oldUrl);
  expect((await page.request.get(oldUrl)).status()).toBe(404);
  expect((await page.request.get(newUrl)).status()).toBe(200);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revoke Work phone" }).click();
  await expect(page.getByRole("button", { name: "Revoke Work phone" })).toHaveCount(0);
  expect((await page.request.get(newUrl)).status()).toBe(404);
});
