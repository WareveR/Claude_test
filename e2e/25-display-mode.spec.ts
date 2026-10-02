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
  await page.goto("/settings");
  await page.getByRole("button", { name: "Use this device as a wall calendar" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByTestId("display-board")).toBeVisible();
}

test("turning Display Mode on shows the board and switches Reminders off", async ({ page }) => {
  await signIn(page);
  await addEntry(page, "Family lunch", "12:00", { notes: "Bring the wine" });
  await addEntry(page, "Therapy with Dr Silva", "10:00", { private: true });
  await addTask(page, "Water the plants");
  await addTask(page, "Secret errand", { private: true });

  // A weather place, so the hourly strip has something to show.
  await page.goto("/settings");
  await page.getByLabel("Town").fill("Lis");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Save Lisboa" }).click();
  await expect(page.getByRole("button", { name: "Remove Lisboa" })).toBeVisible();

  expect((await (await page.request.get("/api/device")).json()).remindersOn).toBe(true);
  await turnOnDisplayMode(page);
  expect((await (await page.request.get("/api/device")).json()).remindersOn).toBe(false);

  // Today on the left, a seven-day grid starting today on the right.
  const board = page.getByTestId("display-board");
  await expect(board.getByTestId("hourly-strip")).toBeVisible();
  await expect(board.getByTestId("briefing")).toBeVisible();
  await expect(board.getByTestId("tasks-accordion")).toHaveAttribute("open", "");
  await expect(board.getByTestId("today-entry").filter({ hasText: "Family lunch" })).toBeVisible();
  for (let i = 0; i < 7; i++) {
    await expect(board.getByTestId(`day-column-${lisbonDate(i)}`)).toBeVisible();
  }
  await expect(board.getByTestId(`day-column-${lisbonDate(7)}`)).toHaveCount(0);

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

test("Private items show only Private and their time; Entries open read-only", async ({ page }) => {
  await signIn(page);
  await turnOnDisplayMode(page);
  const board = page.getByTestId("display-board");

  const list = board.getByTestId("today-entry");
  await expect(list.filter({ hasText: "Private" })).toContainText("10:00");
  await expect(board.getByText("Therapy with Dr Silva")).toHaveCount(0);
  await expect(board.getByText("Secret errand")).toHaveCount(0);
  await expect(board.getByTestId("task").filter({ hasText: "Private" })).toBeVisible();

  await list.filter({ hasText: "Family lunch" }).click();
  await expect(page).toHaveURL(/\/entries\/[^/]+$/);
  const details = page.getByTestId("entry-details");
  await expect(details).toContainText("Family lunch");
  await expect(details).toContainText("12:00");
  await expect(details).toContainText("Bring the wine");
  await expect(page.getByRole("button", { name: /Save|Delete/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Edit/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to the board" }).click();

  await list.filter({ hasText: "Private" }).click();
  await expect(page.getByTestId("entry-details")).toContainText("Private");
  await expect(page.getByTestId("entry-details")).toContainText("10:00");
  await expect(page.getByText("Therapy with Dr Silva")).toHaveCount(0);
});

test("a Task can be ticked on the wall", async ({ page }) => {
  await signIn(page);
  await turnOnDisplayMode(page);
  const box = page.getByRole("checkbox", { name: "Done: Water the plants" });
  await box.check();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Done: Water the plants" })).toBeChecked();
  // The title is not a link to the Task form.
  await expect(page.getByTestId("tasks-accordion").getByRole("link")).toHaveCount(0);
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
  // The left column stays on today.
  await expect(board.getByRole("heading", { name: "Today" })).toBeVisible();

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

test("a long press on the header asks, then leaves Display Mode", async ({ page }) => {
  await signIn(page);
  await turnOnDisplayMode(page);
  const header = page.locator("header");
  const box = (await header.boundingBox())!;
  const press = async () => {
    await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();
  };

  await press();
  const dialog = page.getByRole("dialog", { name: "Leave Display Mode?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(page.getByTestId("display-board")).toBeVisible();

  await press();
  await page
    .getByRole("dialog", { name: "Leave Display Mode?" })
    .getByRole("button", { name: "Leave" })
    .click();
  await expect(page.getByTestId("display-board")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/display$/);
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("display-board")).toHaveCount(0);
});
