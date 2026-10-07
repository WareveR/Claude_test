import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("create, see, edit and delete Entries in the week view", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-10-12");

  await page.getByRole("link", { name: "New entry" }).click();
  // Cancel and Save stay on screen without scrolling the long form.
  await expect(page.getByRole("button", { name: "Save" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await page.getByLabel("Title").fill("Dentist");
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Appointment" });
  await page.getByLabel("Date", { exact: true }).fill("2026-10-13");
  await page.getByLabel("Time", { exact: true }).selectOption("15");
  await page.getByLabel("Time: minutes", { exact: true }).selectOption("10");
  await expect(page.getByLabel("Has an end")).toBeChecked();
  await expect(page.getByLabel("1 day before")).toBeChecked();
  await page.getByLabel("Importance").selectOption("high");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  const dentist = page.getByTestId("day-column-2026-10-13").getByTestId("entry");
  await expect(dentist).toContainText("15:10");
  await expect(dentist).toContainText("Dentist");

  await page.getByRole("link", { name: "New entry" }).click();
  await page.getByLabel("Title").fill("Autumn break");
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Summer break" });
  await expect(page.getByLabel("All day")).toBeChecked();
  await page.getByLabel("From").fill("2026-10-15");
  await page.getByLabel("To (included)").fill("2026-10-17");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("all-day-row").getByTestId("entry")).toHaveText(/Autumn break/);

  await dentist.click();
  await expect(page.getByLabel("Title")).toHaveValue("Dentist");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete entry" }).click();
  await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  await expect(page.getByTestId("day-column-2026-10-13").getByTestId("entry")).toHaveCount(0);
});
