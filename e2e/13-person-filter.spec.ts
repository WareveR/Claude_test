import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Person Filter narrows the Tasks view and is remembered", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/persons/new");
  await page.getByLabel("Name", { exact: true }).fill("Caio");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);

  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Caio's homework");
  await page.getByRole("checkbox", { name: "Caio" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText("Fix the bike")).toBeVisible();

  await page.getByLabel("Person filter").first().click();
  const panel = page.getByRole("group", { name: "Person filter" });
  await panel.getByRole("checkbox", { name: "Caio" }).check();
  await panel.getByRole("switch", { name: "Include Family-wide" }).uncheck();
  await expect(page.getByText("Caio's homework")).toBeVisible();
  await expect(page.getByText("Fix the bike")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Caio's homework")).toBeVisible();
  await expect(page.getByText("Fix the bike")).toHaveCount(0);

  await page.getByLabel("Person filter").first().click();
  await panel.getByRole("switch", { name: "Include Family-wide" }).check();
  await expect(page.getByText("Fix the bike")).toBeVisible();
});

test("on a phone on its side the Person Filter panel scrolls to its last switch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await signIn(page);
  await page.goto("/week/2026-10-05");
  await page.getByLabel("Person filter").first().click();
  const panel = page.getByRole("group", { name: "Person filter" });
  const last = panel.getByRole("switch", { name: "Rubbish collection" });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});
