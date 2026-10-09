import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("selecting an item shows its preview; outside closes it, another item replaces it", async ({
  page,
}) => {
  await signIn(page);
  for (const title of ["Call the plumber", "Return the library books"]) {
    await page.goto("/tasks/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Notes").fill(`About ${title}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).not.toHaveURL(/\/tasks\/new$/);
  }
  await page.goto("/tasks");

  const preview = page.getByTestId("preview");
  await page.getByRole("link", { name: /Call the plumber/ }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(preview).toContainText("About Call the plumber");

  // A tap on another item swaps the preview.
  await page.getByRole("link", { name: /Return the library books/ }).click();
  await expect(preview).toHaveCount(1);
  await expect(preview).toContainText("About Return the library books");

  // A tap outside closes it, as do Cancel and Esc.
  await page.getByRole("heading", { name: "Tasks", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("link", { name: /Call the plumber/ }).click();
  await preview.getByRole("button", { name: "Cancel" }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("link", { name: /Call the plumber/ }).click();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);

  // Edit opens the Task's form.
  await page.getByRole("link", { name: /Call the plumber/ }).click();
  await preview.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Call the plumber");
});
