import { expect, type Page } from "@playwright/test";

/** The Owner's email, from 01-first-run.spec.ts. */
export const EMAIL = "david@example.com";
/** The Owner's password after 01-first-run.spec.ts has changed it; specs run in file order. */
export const PASSWORD = "a brand new phrase";

export async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("header-time")).toBeVisible();
}

/** Opens a view from the bar, through its views menu where the bar is too narrow to list them. */
export async function openView(page: Page, name: string) {
  const nav = page.locator("nav[data-view-nav]");
  await nav.waitFor();
  const menu = page.getByTestId("views-menu");
  if (await menu.isVisible()) await menu.click();
  const link = nav.getByRole("link", { name, exact: true });
  const view = (await link.getAttribute("href"))?.split("/")[1];
  await link.click();
  // A big view (the year) can take a moment to draw; until then the old bar is still there.
  await page.locator(`nav[data-view-nav][data-view="${view}"]`).waitFor();
}

/** Leaves the Wall, which asks the signed-in Account's password. */
export async function leaveWall(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave the Wall" });
  await dialog.getByLabel("Password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByTestId("display-board")).toHaveCount(0);
}

/**
 * The Lisbon date `days` from today, counted in calendar days so midnight and the clock change
 * never shift it. `now` is the moment taken as today, such as the page's own clock.
 */
export function lisbonDate(days = 0, now = Date.now()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
