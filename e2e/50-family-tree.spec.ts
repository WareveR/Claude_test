import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

async function save(page: Page) {
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/relatives") && r.request().method() !== "GET",
  );
  await page.getByRole("button", { name: "Save" }).click();
  expect((await saved).ok()).toBe(true);
}

test("builds a family tree and tells how two people are related", async ({ page }) => {
  await signIn(page);
  await page.goto("/tree");
  await expect(page.getByText("The tree is still empty")).toBeVisible();

  await page.getByTestId("tree-add").click();
  await page.getByLabel("Name", { exact: true }).fill("Leonor");
  await page.getByLabel("Nickname").fill("Nonô");
  await page.getByText("Female").click();
  await page.getByLabel("Date of birth").fill("2026-03-01");
  await save(page);

  // From the baby's card: her mother, then the mother's mother.
  const card = page.getByTestId("relative-card");
  await expect(card.getByRole("heading", { name: "Leonor" })).toBeVisible();
  await card.getByRole("link", { name: "Parent" }).click();
  await expect(page.getByText("Parent of Leonor")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Rita");
  await page.getByText("Female").click();
  await save(page);
  await card.getByRole("link", { name: "Parent" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Rosa");
  await page.getByLabel("Nickname").fill("Vovó");
  await page.getByText("Female").click();
  await page.getByLabel("Stories and notes").fill("Makes the best rice pudding.");
  await save(page);
  await expect(card).toContainText("Makes the best rice pudding.");
  await expect(card).toContainText("Leonor's grandmother");

  // Rosa is drawn two generations above Leonor.
  await expect(page.getByText("Grandparents")).toBeVisible();

  // Two people picked: the kinship between them, said from the first.
  await page.getByTestId("relative-Leonor").click();
  await expect(page.getByTestId("kinship")).toHaveText("Rosa is Leonor's grandmother");
  await expect(page.getByTestId("kinship-card")).toContainText("Direct line, degree 2");

  // Remembered after a reload, and the tree link is in the views bar.
  await page.reload();
  await page.getByRole("link", { name: "Tree" }).click();
  await expect(page.getByTestId("relative-Rosa")).toBeVisible();
  await expect(page.getByTestId("relative-Rosa")).toContainText("“Vovó”");
});
