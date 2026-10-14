import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("Coming up holds today's and overdue Tasks, other days' accordions only theirs", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Pay the electricity bill");
  await page
    .getByLabel("Due date (optional)")
    .fill(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date()));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/summary");
  // 10-tasks left "Renew the passport" two days overdue. What is left to do is in Coming up.
  const left = page.getByTestId("coming-up-tasks");
  await expect(left).toContainText("1 overdue");
  await expect(left).toContainText("Renew the passport");

  await left.getByRole("checkbox", { name: "Done: Pay the electricity bill" }).check();
  await expect(left.getByText("Pay the electricity bill")).toHaveClass(/line-through/);

  // Another day's Tasks, shown in place of its calendar, don't hold overdue Tasks.
  await page.goto("/");
  await page.getByRole("link", { name: "Next" }).click();
  await page.getByTestId("period-tasks").click();
  await expect(page.getByTestId("period-tasks-list")).toBeVisible();
  await expect(page.getByTestId("period-tasks-list")).not.toContainText("Renew the passport");
  await expect(page.getByTestId("time-scroller")).toHaveCount(0);
  await page.getByRole("button", { name: "Show the calendar" }).click();
  await expect(page.getByTestId("time-scroller")).toBeVisible();
});
