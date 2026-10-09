import { expect, type Locator, type Page } from "@playwright/test";

/** The Family Password after 01-first-run.spec.ts has changed it; specs run in file order. */
export const PASSWORD = "a brand new phrase";

export async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Family Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("header-time")).toBeVisible();
}

/** Selecting an item shows its preview; its Edit opens the item's own page. */
export async function openToEdit(page: Page, item: Locator) {
  await item.click();
  await page.getByTestId("preview").getByRole("link", { name: "Edit" }).click();
}
