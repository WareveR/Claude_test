import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

async function say(page: Page, sentence: string) {
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  // The whole sheet is on screen, not pushed above the header.
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog.getByLabel("Say or type one sentence").fill(sentence);
  await dialog.getByRole("button", { name: "Send" }).click();
  return dialog;
}

async function fakeTask(page: Page, title: string) {
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "task",
        values: {
          title,
          notes: "",
          dueDate: "2026-10-20",
          dueTime: null,
          personIds: [],
          private: false,
          repetition: null,
          checklistId: null,
        },
        summary: `New task: ${title}, 20 October`,
      },
    }),
  );
}

test("Esc closes the sheet and a failed sentence opens the plain Entry form", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  await expect(page.getByRole("dialog", { name: "Voice Entry" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.route("**/api/voice", (route) =>
    route.fulfill({ json: { outcome: "failed", sentence: "Dentist on Tuesday at three" } }),
  );
  await say(page, "Dentist on Tuesday at three");
  await expect(page).toHaveURL(/\/entries\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Dentist on Tuesday at three");
  await expect(page.getByLabel("Type", { exact: true })).toBeVisible();
});

test("readback shows the summary, Save saves and Undo removes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await fakeTask(page, "Voice buy stamps");
  const dialog = await say(page, "task buy stamps");
  await expect(dialog.getByText("New task: Voice buy stamps, 20 October")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Edit" })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(toast).toBeVisible();
  await expect(page.getByText("Voice buy stamps")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Voice buy stamps")).toHaveCount(0);
});

test("an Entry created by voice saves with its values and can be undone", async ({ page }) => {
  await signIn(page);
  const types = await (await page.request.get("/api/entry-types")).json();
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "entry",
        values: {
          title: "Voice dentist",
          entryTypeId: types[0].id,
          time: {
            allDay: false,
            startDate: "2026-10-20",
            startTime: "15:00",
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
        },
        summary: "New entry: Voice dentist, Tuesday, 20 October, 15:00",
      },
    }),
  );
  await page.goto("/day/2026-10-20");
  const dialog = await say(page, "dentist on Tuesday at three");
  await expect(
    dialog.getByText("New entry: Voice dentist, Tuesday, 20 October, 15:00"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("entry").filter({ hasText: "Voice dentist" })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("entry").filter({ hasText: "Voice dentist" })).toHaveCount(0);
});

test("Edit, and turning readback off, open the form filled in", async ({ page }) => {
  await signIn(page);
  await fakeTask(page, "Voice call plumber");
  const dialog = await say(page, "task call plumber");
  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Voice call plumber");

  await page.goto("/settings/device");
  const section = page.locator("section section", {
    has: page.getByRole("heading", { name: "Voice Entry" }),
  });
  const readback = section.getByRole("checkbox");
  await expect(readback).toBeChecked();
  await readback.click();
  await expect(readback).not.toBeChecked();
  await page.reload();
  await expect(readback).not.toBeChecked();

  await say(page, "task call plumber");
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Voice call plumber");

  await page.goto("/settings/device");
  await readback.click();
  await expect(readback).toBeChecked();
});
