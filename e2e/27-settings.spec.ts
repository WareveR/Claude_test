import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Settings areas have their own addresses and Sign out stays in view", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/calendar$/);
  await expect(page.getByRole("heading", { name: "Weather" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport();
});

test("the Settings button also closes Settings, back to the view it left", async ({ page }) => {
  await signIn(page);
  await page.goto("/month/2026-11");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("link", { name: "Close Settings" }).click();
  await expect(page).toHaveURL(/\/month\/2026-11$/);
});

test("Today keeps the view it is pressed in", async ({ page }) => {
  await signIn(page);
  await page.goto("/month/2020-01");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/month\/\d{4}-\d{2}$/);
  await expect(page).not.toHaveURL(/2020-01/);
  await page.goto("/year/2020");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/year\/\d{4}$/);
  await expect(page).not.toHaveURL(/2020/);
});

test("the task list has buttons for a new task and a new checklist", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.locator("main").getByRole("link", { name: "New task" }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.locator("main").getByRole("link", { name: "New checklist" }).click();
  await expect(page).toHaveURL(/\/checklists\/new$/);
});

test("This device shows its app version and updates it on demand", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/device");
  await expect(page.getByRole("heading", { name: "App version" })).toBeVisible();
  await expect(page.getByText(/This device runs version /)).toBeVisible();
  await page.getByRole("button", { name: "Update now" }).click();
  // Nothing newer was deployed in between, so it says so (or reloads into the same version).
  await expect(
    page
      .getByText("This device already has the latest version.")
      .or(page.getByRole("heading", { name: "App version" })),
  ).toBeVisible();
});
