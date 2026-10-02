import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a weekly Entry on two weekdays shows every week", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=2026-10-06&time=18:00");
  await page.getByLabel("Title").fill("Karate");
  await page.getByLabel("Repeats").selectOption("weekly");
  await page.getByLabel("Thu").check();
  await page.getByLabel("Ends").selectOption("count");
  await page.getByLabel("Number of times").fill("6");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/week/2026-10-12");
  await expect(page.getByTestId("day-column-2026-10-13").getByTestId("entry")).toContainText(
    "Karate",
  );
  await expect(page.getByTestId("day-column-2026-10-15").getByTestId("entry")).toContainText(
    "Karate",
  );
  await page.goto("/week/2026-10-19");
  await expect(page.getByTestId("day-column-2026-10-20").getByTestId("entry")).toContainText(
    "Karate",
  );
  // Six times: 6, 8, 13, 15, 20 and 22 October.
  await page.goto("/week/2026-10-26");
  await expect(page.getByTestId("day-column-2026-10-27").getByTestId("entry")).toHaveCount(0);
});
