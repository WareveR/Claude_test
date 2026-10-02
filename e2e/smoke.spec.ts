import { expect, test } from "@playwright/test";

test("the app loads and reaches its API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Calendário da Família" })).toBeVisible();
  await expect(page.getByTestId("api-status")).toHaveText("ok");
});
