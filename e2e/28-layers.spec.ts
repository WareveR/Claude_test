import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("Calendar Layers turned on in the filter panel mark the days", async ({ page }) => {
  await signIn(page);
  await page.goto("/month/2026-10");
  await expect(page.getByTestId("note-2026-10-26")).toHaveCount(0);

  await page.getByLabel("Person filter").first().click();
  const panel = page.getByRole("group", { name: "Person filter" });
  await panel.getByLabel("Moon phases").check();
  await panel.getByLabel("Clock change").check();
  await panel.getByLabel("Special days").check();

  await expect(page.getByTestId("note-2026-10-26")).toContainText("Full moon");
  await expect(page.getByTestId("note-2026-10-25")).toContainText(
    "Clocks change tonight: back 1 h",
  );
  await expect(page.getByTestId("note-2026-10-31")).toContainText("Halloween");

  // Remembered on this device.
  await page.reload();
  await expect(page.getByTestId("note-2026-10-26")).toContainText("Full moon");

  await page.getByLabel("Person filter").first().click();
  for (const name of ["Moon phases", "Clock change", "Special days"]) {
    await page.getByRole("group", { name: "Person filter" }).getByLabel(name).uncheck();
  }
  await expect(page.getByTestId("note-2026-10-26")).toHaveCount(0);
});
