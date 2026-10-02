import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

test("a Checklist groups Tasks with progress in the Tasks view", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New checklist" }).click();
  await page.getByLabel("Name").fill("Summer cleaning");
  await page.getByLabel("Starts (optional)").fill(lisbonDate(-1));
  await page.getByLabel("Ends").fill(lisbonDate(10));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  const checklist = page.getByTestId("checklist").filter({ hasText: "Summer cleaning" });
  await checklist.getByText("Summer cleaning").click();
  for (const [title, due] of [
    ["Wash the windows", null],
    ["Clear the garage", lisbonDate(2)],
  ] as const) {
    await checklist.getByRole("link", { name: "Add a task" }).click();
    await expect(page.getByText('In the checklist "Summer cleaning".')).toBeVisible();
    await page.getByLabel("Title").fill(title);
    if (due) await page.getByLabel("Due date (optional)").fill(due);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await checklist.getByText("Summer cleaning").first().click();
  }

  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(checklist).toContainText("0 of 2");
  // The dated Task also shows on its own, labelled with its Checklist; the undated one only inside.
  const rows = (title: string) => upcoming.getByTestId("task").filter({ hasText: title });
  await expect(rows("Clear the garage")).toHaveCount(2);
  await expect(rows("Clear the garage").last()).toContainText("Summer cleaning");
  await expect(rows("Wash the windows")).toHaveCount(1);

  await checklist.getByRole("checkbox", { name: "Done: Wash the windows" }).check();
  await expect(checklist).toContainText("1 of 2");
});

test("a Checklist's period shows as a bar and Use again starts a new round", async ({ page }) => {
  await signIn(page);
  const garage = lisbonDate(2);
  // The dated Checklist Task joins its day's Tasks accordion.
  await page.goto(`/month/${garage.slice(0, 7)}?day=${garage}`);
  await expect(page.getByTestId("tasks-accordion")).toContainText("Tasks 1");

  await page.goto("/");
  await page.getByRole("link", { name: "Week" }).click();
  const bar = page.getByRole("link", { name: /Summer cleaning 1\/2/ }).first();
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page).toHaveURL(/\/checklists\//);

  await page.getByRole("button", { name: "Use again" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  const checklist = page.getByTestId("checklist").filter({ hasText: "Summer cleaning" });
  await expect(checklist).toContainText("0 of 2");
  await checklist.getByText("Summer cleaning").click();
  await checklist.getByRole("link", { name: "Edit checklist" }).click();
  await expect(page.getByText(/\d{4}: 1 of 2/)).toBeVisible();
});
