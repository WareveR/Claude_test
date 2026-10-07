import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

test("Refresh writes the countdown list, whose Entries open in a popup", async ({ page }) => {
  await signIn(page);
  await page.goto(`/entries/new?date=${lisbonDate(1)}&time=09:30`);
  await page.getByLabel("Title").fill("Dentist checkup");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Book the vet");
  await page.getByLabel("Due date (optional)").fill(lisbonDate(1));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/");
  const band = page.getByTestId("coming-up");
  await expect(band).toContainText("No briefing yet");
  await band.getByRole("button", { name: "Refresh" }).click();
  const line = band.getByTestId("briefing-line").filter({ hasText: "Book the vet" });
  await expect(line).toBeVisible();
  // A Task is plain text; the Tasks are a tap away below.
  await expect(line.getByRole("button")).toHaveCount(0);

  const entry = band.getByTestId("briefing-line").getByRole("button", { name: /Dentist checkup/ });
  await entry.click();
  const popup = page.getByRole("dialog", { name: "Dentist checkup" });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("09:30");
  await popup.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await entry.click();
  await page.getByRole("dialog").getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/entries\/[^/]+\?occurrence=/);
});

test("Coming up is beside every view and hiding the panel is remembered", async ({ page }) => {
  await signIn(page);
  const panel = page.getByTestId("coming-up");
  await expect(panel.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(panel.getByTestId("briefing-line").first()).toBeVisible();

  // Not only today: what is coming up is beside any day, week, month or year.
  await page.goto(`/day/${lisbonDate(1)}`);
  await expect(panel.getByTestId("briefing-line").first()).toBeVisible();
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(panel.getByTestId("briefing-line").first()).toBeVisible();

  await page.getByRole("button", { name: "Hide panel" }).click();
  await expect(page.getByTestId("side-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show panel" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.reload();
  await expect(page.getByTestId("side-panel")).toBeHidden();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByTestId("side-panel")).toBeHidden();
  await page.getByRole("button", { name: "Show panel" }).click();
  await expect(panel.getByTestId("briefing-line").first()).toBeVisible();
});
