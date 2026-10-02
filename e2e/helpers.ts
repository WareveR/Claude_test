import { expect, type Page } from "@playwright/test";

/** The Family Password after 01-first-run.spec.ts has changed it; specs run in file order. */
export const PASSWORD = "a brand new phrase";

export async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Family Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("header-time")).toBeVisible();
}
