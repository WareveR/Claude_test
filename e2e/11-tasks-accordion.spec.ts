import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the day view's Tasks accordion holds today's and overdue Tasks", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Pay the electricity bill");
  await page
    .getByLabel("Due date (optional)")
    .fill(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date()));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/");
  // 10-tasks left "Renew the passport" two days overdue.
  const accordion = page.getByTestId("tasks-accordion");
  await expect(accordion).toContainText("1 overdue");
  await accordion.getByText(/Tasks \d+/).click();
  await expect(accordion).toContainText("Renew the passport");

  await accordion.getByRole("checkbox", { name: "Done: Pay the electricity bill" }).check();
  await expect(accordion.getByText("Pay the electricity bill")).toHaveClass(/line-through/);

  // Another day's period doesn't hold overdue Tasks.
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page.getByText("Renew the passport")).toHaveCount(0);
});
