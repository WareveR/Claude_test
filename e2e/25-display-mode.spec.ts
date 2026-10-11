import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

async function addEntry(page: Page, title: string, startTime: string, extra = {}) {
  const types = await (await page.request.get("/api/entry-types")).json();
  const res = await page.request.post("/api/entries", {
    headers: ORIGIN,
    data: {
      title,
      entryTypeId: types[0].id,
      time: {
        allDay: false,
        startDate: lisbonDate(0),
        startTime,
        endDate: null,
        endTime: null,
      },
      personIds: [],
      importance: "normal",
      location: "",
      notes: "",
      icon: null,
      private: false,
      reminders: [],
      repetition: null,
      birthYearKnown: false,
      ...extra,
    },
  });
  expect(res.ok()).toBe(true);
}

async function addTask(page: Page, title: string, extra = {}) {
  const res = await page.request.post("/api/tasks", {
    headers: ORIGIN,
    data: {
      title,
      notes: "",
      dueDate: lisbonDate(0),
      dueTime: null,
      personIds: [],
      private: false,
      repetition: null,
      checklistId: null,
      ...extra,
    },
  });
  expect(res.ok()).toBe(true);
}

async function turnOnDisplayMode(page: Page) {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByTestId("display-board")).toBeVisible();
}

test("the Wall view shows the board", async ({ page }) => {
  await signIn(page);
  await addEntry(page, "Family lunch", "12:00", { notes: "Bring the wine" });
  await addEntry(page, "Therapy with Dr Silva", "10:00", { private: true });
  await addTask(page, "Water the plants");
  await addTask(page, "Secret errand", { private: true });

  // A weather place, so the hourly strip has something to show.
  await page.goto("/settings/calendar");
  await page.getByLabel("Town").fill("Lis");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Save Lisboa" }).click();
  await expect(page.getByRole("button", { name: "Remove Lisboa" })).toBeVisible();

  await turnOnDisplayMode(page);

  // Today's Entries on the left, a seven-day grid starting today on the right; the weather and
  // what's coming up are the Summary's.
  const board = page.getByTestId("display-board");
  await expect(board.getByTestId("hourly-strip")).toHaveCount(0);
  await expect(board.getByTestId("coming-up")).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("button", { name: "Wall" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // The grid fills the screen: the coming days' list is in the Summary.
  await expect(board.getByTestId("today-entry")).toHaveCount(0);
  for (let i = 0; i < 7; i++) {
    await expect(board.getByTestId(`day-column-${lisbonDate(i)}`)).toBeVisible();
  }
  await expect(board.getByTestId(`day-column-${lisbonDate(7)}`)).toHaveCount(0);
  // The arrows' row names only the month and year; the days carry their numbers.
  const month = (days: number) =>
    new Date(`${lisbonDate(days)}T12:00:00Z`).toLocaleString("en-GB", { month: "long" });
  await expect(board.getByTestId("board-range")).toContainText(month(0));
  await expect(board.getByTestId("board-range")).toContainText(month(6));
  await expect(board.getByTestId("board-range")).toContainText(lisbonDate(6).slice(0, 4));
  // The corner button hides the weather for more hours, as in the week view.
  await expect(board.getByTestId(`week-weather-${lisbonDate(0)}`)).toBeVisible();
  await board.getByRole("button", { name: "Hide weather" }).click();
  await expect(board.locator('[data-testid^="week-weather-"]')).toHaveCount(0);
  await board.getByRole("button", { name: "Show weather" }).click();
  await expect(board.getByTestId(`week-weather-${lisbonDate(0)}`)).toBeVisible();
  // The week's Tasks are hidden, the button under it says how many, and shows them when pressed.
  await expect(board.getByTestId("tasks-accordion")).toHaveCount(0);
  await expect(board.getByTestId("week-tasks-count")).not.toHaveText("0");
  await board
    .getByRole("button", { name: /^Show the \d+ hidden tasks$|^Show the hidden task$/ })
    .click();
  await expect(board.getByTestId("tasks-accordion")).toContainText("Water the plants");
  await board.getByRole("button", { name: "Hide tasks" }).click();
  await expect(board.getByTestId("tasks-accordion")).toHaveCount(0);

  // No microphone, no Settings.
  await expect(page.getByRole("button", { name: "Voice Entry" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

  // The board survives a reload, and other addresses lead back to it.
  await page.reload();
  await expect(page.getByTestId("display-board")).toBeVisible();
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/display$/);
  await page.goto("/entries/new");
  await expect(page).toHaveURL(/\/display$/);
});

test("the Summary lists the coming days; Private items show only Private and their time", async ({
  page,
}) => {
  await signIn(page);
  await turnOnDisplayMode(page);
  const board = page.getByTestId("display-board");
  await expect(board.getByText("Therapy with Dr Silva")).toHaveCount(0);
  await expect(board.getByText("Secret errand")).toHaveCount(0);

  // The Summary lists the next seven days' Entries, today's first.
  await page.getByRole("banner").getByRole("button", { name: "Summary" }).click();
  const week = page.getByTestId("week-entries");
  await expect(week.getByRole("heading", { name: "Today" })).toBeVisible();
  const list = week.getByTestId("today-entry");
  await expect(list.filter({ hasText: "Private" })).toContainText("10:00");
  await expect(week.getByText("Therapy with Dr Silva")).toHaveCount(0);
  await expect(list.filter({ hasText: "Family lunch" })).toContainText("12:00");
});

test("‹ › move the grid a week, a pill returns, and three idle minutes return too", async ({
  page,
}) => {
  await page.clock.install();
  await signIn(page);
  await turnOnDisplayMode(page);
  const board = page.getByTestId("display-board");
  const pill = board.getByTestId("back-to-today");

  // Filter on the board: remembered, and not reset by the return.
  await board.getByLabel("Person filter").first().click();
  const panel = page.getByRole("group", { name: "Person filter" });
  await panel.getByRole("checkbox", { name: "Caio" }).check();
  await expect(board.locator("summary").getByRole("img", { name: "Caio" })).toBeVisible();

  await expect(pill).toHaveCount(0);
  await board.getByRole("button", { name: "Next" }).click();
  await expect(board.getByTestId(`day-column-${lisbonDate(7)}`)).toBeVisible();
  await expect(board.getByTestId(`day-column-${lisbonDate(0)}`)).toHaveCount(0);
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAccessibleName("Back to today");
  // It sits on the arrows' row.
  const row = await board.getByRole("button", { name: "Next" }).boundingBox();
  const box = await pill.boundingBox();
  expect(
    Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - ((row?.y ?? 0) + (row?.height ?? 0) / 2)),
  ).toBeLessThan(8);

  await pill.click();
  await expect(board.getByTestId(`day-column-${lisbonDate(0)}`)).toBeVisible();
  await expect(pill).toHaveCount(0);

  await board.getByRole("button", { name: "Previous" }).click();
  await expect(board.getByTestId(`day-column-${lisbonDate(-7)}`)).toBeVisible();
  await page.clock.fastForward("03:05");
  await expect(board.getByTestId(`day-column-${lisbonDate(0)}`)).toBeVisible();
  await expect(pill).toHaveCount(0);

  // Still filtered after the return, and after a reload.
  await expect(board.locator("summary").getByRole("img", { name: "Caio" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("display-board").locator("summary").getByRole("img", { name: "Caio" }),
  ).toBeVisible();
});

test("Back from an Entry returns to the week the board showed", async ({ page }) => {
  await signIn(page);
  await addEntry(page, "Piano recital", "18:00", {
    time: {
      allDay: false,
      startDate: lisbonDate(8),
      startTime: "18:00",
      endDate: null,
      endTime: null,
    },
  });
  await turnOnDisplayMode(page);
  const board = page.getByTestId("display-board");
  await board.getByRole("button", { name: "Next" }).click();
  await board
    .getByTestId(`day-column-${lisbonDate(8)}`)
    .getByTestId("entry")
    .click();
  await expect(page.getByTestId("entry-details")).toContainText("Piano recital");
  await page.getByRole("button", { name: "Back to the board" }).click();
  await expect(board.getByTestId(`day-column-${lisbonDate(8)}`)).toBeVisible();
  await expect(board.getByTestId("back-to-today")).toBeVisible();
});

test("the Wall and Summary switches are exclusive and both off return to the page before", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/week/${lisbonDate(14)}`);
  await expect(page.getByTestId(`day-column-${lisbonDate(14)}`)).toBeVisible();
  const before = page.url();
  const header = page.getByRole("banner");
  const wall = header.getByRole("button", { name: "Wall" });
  const summary = header.getByRole("button", { name: "Summary" });

  // Summary on: its own screen, with today's weather and what's coming up.
  await summary.click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(summary).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("summary").getByTestId("coming-up")).toBeVisible();
  // What is left to do is on the right of the Briefing.
  const briefingBox = await page.getByTestId("coming-up").boundingBox();
  const tasksBox = await page.getByTestId("coming-up-tasks").boundingBox();
  expect(tasksBox!.x).toBeGreaterThan(briefingBox!.x + briefingBox!.width - 1);
  // A Task can be ticked there.
  const box = page.getByRole("checkbox", { name: "Done: Water the plants" });
  await box.check();
  await expect(box).toBeChecked();

  // Wall on turns the Summary off.
  await wall.click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(wall).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toHaveAttribute("aria-pressed", "false");
  // Summary on from the wall leaves the wall.
  await summary.click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(wall).toHaveAttribute("aria-pressed", "false");

  // Both off: back to the week from before.
  await summary.click();
  await expect(page).toHaveURL(before);

  // Settings opened from the Summary close back to it, and the Summary still returns to the week.
  await summary.click();
  await expect(page).toHaveURL(/\/summary$/);
  await header.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await header.getByRole("link", { name: "Close Settings" }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await summary.click();
  await expect(page).toHaveURL(before);

  // The same from the wall, after a reload too.
  await wall.click();
  await expect(page.getByTestId("display-board")).toBeVisible();
  await page.reload();
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  await expect(page.getByTestId("display-board")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/display$/);
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("display-board")).toHaveCount(0);
});
