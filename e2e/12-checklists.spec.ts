import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

test("a Checklist's page holds its items to tick, add, rename and remove", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New checklist" }).click();
  await page.getByLabel("Name").fill("Summer cleaning");
  await page.getByLabel("Starts (optional)").fill(lisbonDate(-1));
  await page.getByLabel("Ends (optional)").fill(lisbonDate(10));
  await page.getByRole("button", { name: "Save" }).click();

  // Saving opens the Checklist's own page.
  await expect(page).toHaveURL(/\/checklists\/[^/]+$/);
  const detail = page.getByTestId("checklist-detail");
  await expect(detail.getByRole("heading", { name: "Summer cleaning" })).toBeVisible();
  for (const title of ["Wash the windows", "Clear the garage", "Sort the toys"]) {
    await detail.getByLabel("New item").fill(title);
    await detail.getByRole("button", { name: "Add", exact: true }).click();
    await expect(detail.getByTestId("checklist-item").filter({ hasText: title })).toBeVisible();
  }
  await expect(detail).toContainText("0 of 3");

  await detail.getByRole("checkbox", { name: "Done: Wash the windows" }).check();
  await expect(detail).toContainText("1 of 3");
  await detail.getByRole("checkbox", { name: "Done: Wash the windows" }).uncheck();
  await expect(detail).toContainText("0 of 3");
  await detail.getByRole("checkbox", { name: "Done: Wash the windows" }).check();

  await detail.getByRole("button", { name: "Edit Clear the garage" }).click();
  await detail.getByLabel("Name").fill("Clear out the garage");
  await detail.getByRole("button", { name: "Save", exact: true }).click();
  await expect(detail.getByText("Clear out the garage")).toBeVisible();

  await detail.getByRole("button", { name: "Remove Sort the toys" }).click();
  await expect(detail.getByText("Sort the toys")).toHaveCount(0);
  await expect(detail).toContainText("1 of 2");

  // In the Tasks view the Checklist is one row; its items never show on their own.
  await page.goto("/tasks");
  const checklist = page.getByTestId("checklist").filter({ hasText: "Summer cleaning" });
  await expect(checklist).toContainText("1 of 2");
  await expect(page.getByTestId("task").filter({ hasText: "Clear out the garage" })).toHaveCount(0);
  await checklist.click();
  await expect(page.getByTestId("checklist-detail")).toContainText("Clear out the garage");
  // Back returns to where the Checklist was opened.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test("a Checklist's bar opens its page, and Use again starts a new round", async ({ page }) => {
  await signIn(page);
  // Checklist items never join a day's Tasks accordion.
  const day = lisbonDate(2);
  await page.goto(`/month/${day.slice(0, 7)}?day=${day}`);
  await expect(page.getByTestId("task").filter({ hasText: "Clear out the garage" })).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("link", { name: "Week" }).click();
  const bar = page.getByRole("link", { name: /Summer cleaning 1\/2/ }).first();
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page).toHaveURL(/\/checklists\/[^/]+$/);
  await expect(page.getByTestId("checklist-detail")).toContainText("1 of 2");

  await page.getByRole("link", { name: "Edit checklist" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Use again" }).click();
  await expect(page).toHaveURL(/\/checklists\/[^/]+$/);
  await expect(page.getByTestId("checklist-detail")).toContainText("0 of 2");
  await page.getByRole("link", { name: "Edit checklist" }).click();
  await expect(page.getByText(/\d{4}: 1 of 2/)).toBeVisible();
});

test("a Checklist repeating every Sunday shows only on Sundays", async ({ page }) => {
  await signIn(page);
  const weekdayOf = (date: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const today = lisbonDate(0);
  let sunday = 0;
  while (weekdayOf(lisbonDate(sunday)) !== "Sun") sunday++;

  await page.goto("/checklists/new");
  await page.getByLabel("Name").fill("Sunday chores");
  // No start: the rounds count from today.
  await page.getByLabel("Repeats").selectOption("weekly");
  await expect(page.getByText(/Rounds count from/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Sun", exact: true }).check();
  if (weekdayOf(today) !== "Sun") {
    await page.getByRole("checkbox", { name: weekdayOf(today), exact: true }).uncheck();
  }
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("checklist-detail")).toContainText("No items yet.");

  const chores = page.getByRole("link", { name: /Sunday chores/ });
  await page.goto(`/day/${lisbonDate(sunday)}`);
  await expect(chores.first()).toBeVisible();
  await page.goto(`/day/${lisbonDate(sunday + 1)}`);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(chores).toHaveCount(0);
  await page.goto(`/day/${lisbonDate(sunday + 7)}`);
  await expect(chores.first()).toBeVisible();
});

test("a Checklist's items can carry a note and be grouped under sections", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New checklist" }).click();
  await page.getByLabel("Name").fill("Birthday party");
  await page.getByRole("button", { name: "Save" }).click();
  const detail = page.getByTestId("checklist-detail");
  await expect(detail.getByRole("heading", { name: "Birthday party" })).toBeVisible();

  const add = async (title: string, note = "", section?: string) => {
    if (section !== undefined) await detail.getByLabel("Section (optional)").fill(section);
    await detail.getByLabel("New item").fill(title);
    if (note) await detail.getByLabel("Note (optional)").fill(note);
    await detail.getByRole("button", { name: "Add", exact: true }).click();
    await expect(detail.getByTestId("checklist-item").filter({ hasText: title })).toBeVisible();
  };
  await add("Print the photos");
  await add("Cake", "pick up on Saturday", "Food and drinks");
  // The section stays for the next item.
  await add("Cheese puffs", "still to make");
  await add("Pineapple", "Aldi", "Shopping");

  const sections = detail.getByTestId("checklist-section");
  await expect(sections).toHaveCount(2);
  const food = sections.filter({ hasText: "Food and drinks" });
  await expect(food.getByTestId("checklist-item")).toHaveCount(2);
  await expect(food.getByTestId("checklist-item-note")).toContainText([
    "pick up on Saturday",
    "still to make",
  ]);
  await food.getByRole("checkbox", { name: "Done: Cake" }).check();
  await expect(food).toContainText("1 of 2");

  // Editing an item moves it to another section.
  await detail.getByRole("button", { name: "Edit Pineapple" }).click();
  await detail.getByLabel("Section (optional)").first().fill("Food and drinks");
  await detail.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sections).toHaveCount(1);
  await expect(food.getByTestId("checklist-item")).toHaveCount(3);
  await page.screenshot({ path: "test-results/checklist-sections.png", fullPage: true });

  // A section opens and closes like an accordion, its progress in the heading.
  const heading = food.locator("h2").getByRole("button");
  await expect(heading).toHaveAttribute("aria-expanded", "true");
  await heading.click();
  await expect(food.getByTestId("checklist-item")).toHaveCount(0);
  await expect(heading).toContainText("1 of 3");
  await heading.click();
  await food.getByRole("checkbox", { name: "Done: Cheese puffs" }).check();
  await food.getByRole("checkbox", { name: "Done: Pineapple" }).check();
  await expect(heading).toContainText("3 of 3");
  // A finished section starts closed.
  await page.reload();
  await expect(food.locator("h2").getByRole("button")).toHaveAttribute("aria-expanded", "false");
});
