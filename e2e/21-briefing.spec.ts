import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

test("Refresh writes the countdown list, which links to the item", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Book the vet");
  await page.getByLabel("Due date (optional)").fill(lisbonDate(1));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/");
  const band = page.getByTestId("briefing");
  await expect(band).toContainText("No briefing yet");
  await band.getByRole("button", { name: "Refresh" }).click();
  const line = band.getByTestId("briefing-line").filter({ hasText: "Book the vet" });
  await expect(line).toBeVisible();
  await line.getByRole("link").click();
  await expect(page).toHaveURL(/\/tasks\/[^/]+$/);
});

test("the band is only on today and its collapsed state is remembered", async ({ page }) => {
  await signIn(page);
  const band = page.getByTestId("briefing");
  await expect(band.getByTestId("briefing-line").first()).toBeVisible();

  await page.goto(`/day/${lisbonDate(1)}`);
  await expect(page.getByTestId("briefing")).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("button", { name: "Briefing" }).click();
  await expect(page.getByRole("button", { name: "Briefing" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(band.getByTestId("briefing-line").first()).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Briefing" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
