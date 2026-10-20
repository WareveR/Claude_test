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

test("an overdue Task in Still to do moves to today or tomorrow in one tap", async ({ page }) => {
  await signIn(page);
  const day = (offset: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(
      new Date(Date.now() + offset * 86_400_000),
    );
  // From the page, so the request carries the app's own origin.
  const id = (await page.evaluate(
    `fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ title: "Return the library books", notes: "", dueDate: "${day(-3)}",
         dueTime: null, personIds: [], private: false, repetition: null }) })
     .then((r) => r.json()).then((t) => t.id)`,
  )) as string;
  await page.goto("/summary");
  const left = page.getByTestId("coming-up-tasks");
  const row = left.getByTestId("task").filter({ hasText: "Return the library books" });
  await expect(
    row.getByRole("button", { name: "Move Return the library books to today" }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Move Return the library books to tomorrow" }).click();
  // Now due tomorrow: still in the next seven days, no longer overdue.
  await expect(row.getByRole("button", { name: /Move .* to today/ })).toHaveCount(0);
  const task = (await (await page.request.get(`/api/tasks/${id}`)).json()) as { dueDate: string };
  expect(task.dueDate).toBe(day(1));
  await page.evaluate(`fetch("/api/tasks/${id}", { method: "DELETE" })`);
});
