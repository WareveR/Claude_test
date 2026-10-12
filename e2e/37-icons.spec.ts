import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("icons come in groups and are found by name", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-12-07");
  await page.getByRole("link", { name: "New", exact: true }).click();
  const picker = page.getByTestId("icon-picker");

  // A group at a time.
  await picker.getByRole("tab", { name: "Sport", exact: true }).click();
  await expect(picker.getByRole("radio", { name: "Swimming" })).toBeVisible();
  await expect(picker.getByRole("radio", { name: "Massage" })).toHaveCount(0);

  // The box finds across groups; Enter there doesn't save the Entry.
  await picker.getByRole("searchbox", { name: "Find an icon" }).fill("wax");
  await picker.getByRole("searchbox", { name: "Find an icon" }).press("Enter");
  await expect(page).toHaveURL(/\/entries\/new/);
  await picker.getByTitle("Waxing").click();

  await page.getByLabel("Title").fill("Waxing appointment");
  await page.getByLabel("Date", { exact: true }).fill("2026-12-08");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\/new/);
  await page.getByTestId("day-column-2026-12-08").getByTestId("entry").click();
  await page.getByRole("dialog").getByRole("link", { name: "Edit" }).click();
  // Opened on the chosen icon's group.
  await expect(page.getByRole("tab", { name: "Beauty and wellbeing" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("radio", { name: "Waxing" })).toBeChecked();
});
