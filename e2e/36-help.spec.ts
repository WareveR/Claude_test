import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("main buttons explain themselves on hover, as much as the device's help level says", async ({
  page,
}) => {
  await signIn(page);
  const tip = page.getByRole("tooltip");

  // Medium, the default: the name and what it does.
  await page.goto("/month/2027-03");
  await page.getByRole("link", { name: "Search" }).hover();
  await expect(tip).toContainText("Search");
  await expect(tip).toContainText("Finds Entries and tasks by their words.");
  await expect(tip).not.toContainText("in quotes");
  // Moving away hides it.
  await page.getByRole("heading", { level: 1 }).hover();
  await expect(tip).toHaveCount(0);

  // High adds what follows, and the ⓘ on field titles that explain themselves.
  await page.goto("/settings/device");
  await page.getByLabel("How much it explains").selectOption("high");
  await page.goto("/month/2027-03");
  await page.getByRole("link", { name: "Search" }).hover();
  await expect(tip).toContainText("in quotes");
  await page.goto("/entries/new?date=2027-03-10");
  await page.locator("legend[data-help=persons]").hover();
  await expect(tip).toContainText("Who this is for.");

  // Low names only the buttons that are just an icon.
  await page.goto("/settings/device");
  await page.getByLabel("How much it explains").selectOption("low");
  await page.goto("/month/2027-03");
  await page.getByRole("link", { name: "Search" }).hover();
  await expect(tip).toHaveText("Search");
  await page.getByRole("link", { name: "Today", exact: true }).hover();
  await page.waitForTimeout(800);
  await expect(tip).toHaveCount(0);

  // Off shows nothing, and the choice outlives a reload.
  await page.goto("/settings/device");
  await page.getByLabel("How much it explains").selectOption("off");
  await page.reload();
  await expect(page.getByLabel("How much it explains")).toHaveValue("off");
  await page.goto("/month/2027-03");
  await page.getByRole("link", { name: "Search" }).hover();
  await page.waitForTimeout(800);
  await expect(tip).toHaveCount(0);
});
