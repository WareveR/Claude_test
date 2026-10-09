import { expect, test } from "@playwright/test";
import { openToEdit, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a date of birth keeps a Birthday with the age on the calendar", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/persons/new");
  await page.getByLabel("Name", { exact: true }).fill("Bia");
  await page.getByLabel("Date of birth (optional)").fill("2016-10-20");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);

  await page.goto("/month/2026-10?day=2026-10-20");
  const birthday = page.getByTestId("picked-day").getByRole("link", { name: /Bia, 10/ });
  await openToEdit(page, birthday);
  await expect(page.getByText("This Birthday follows Bia's date of birth")).toBeVisible();
  await expect(page.getByLabel("Title")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete entry" })).toHaveCount(0);
  await page.getByLabel("Notes").fill("Loves drawing");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  // Archiving asks whether to keep the Birthday; kept, it becomes Family-wide and editable.
  await page.goto("/settings/family");
  await page.getByRole("link", { name: /Bia/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);
  await page.goto("/month/2026-10?day=2026-10-20");
  await openToEdit(page, page.getByTestId("picked-day").getByRole("link", { name: /Bia, 10/ }));
  await expect(page.getByLabel("Title")).toBeEnabled();
  await expect(page.getByLabel("Notes")).toHaveValue("Loves drawing");
});

test("a hand-entered Birthday shows the age when the year is known", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=1946-03-12");
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Birthday" });
  await page.getByLabel("Title").fill("Grandma Rosa");
  await page.getByLabel(/Birth year known/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/month/2026-03?day=2026-03-12");
  await expect(
    page.getByTestId("picked-day").getByRole("link", { name: /Grandma Rosa, 80/ }),
  ).toBeVisible();
});
