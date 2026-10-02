import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("day and month views show Entries", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=2026-11-04&time=18:00");
  await page.getByLabel("Title").fill("Parents' evening");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/day/2026-11-04");
  await expect(page.getByTestId("day-column-2026-11-04").getByTestId("entry")).toContainText(
    "Parents' evening",
  );

  await page.goto("/month/2026-11");
  await expect(page.getByTestId("month-day-2026-11-04")).toContainText("Parents' evening");
  await page.getByTestId("month-day-2026-11-04").click();
  await expect(page).toHaveURL(/\/month\/2026-11\?day=2026-11-04$/);
  await expect(page.getByTestId("picked-day")).toContainText("18:00");
  await page.getByTestId("month-day-2026-11-05").click();
  await expect(page.getByTestId("picked-day")).toContainText("Nothing on this day.");
});
