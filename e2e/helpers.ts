import { expect, type Page } from "@playwright/test";

/** The Family Password after 01-first-run.spec.ts has changed it; specs run in file order. */
export const PASSWORD = "a brand new phrase";

export async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Family Password").fill(PASSWORD);
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
