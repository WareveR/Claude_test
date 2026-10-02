import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

type Task = { id: string; doneAt: string | null };

async function addTask(page: Page, title: string) {
  const res = await page.request.post("/api/tasks", {
    headers: { Origin: "http://localhost:4173" },
    data: {
      title,
      notes: "",
      dueDate: "2026-10-20",
      dueTime: null,
      personIds: [],
      private: false,
      repetition: null,
      checklistId: null,
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as Task).id;
}

const doneAt = async (page: Page, id: string) =>
  ((await (await page.request.get(`/api/tasks/${id}`)).json()) as Task).doneAt;

const donePlan = (id: string, label: string, scope = "all") => ({
  kind: "task",
  id,
  date: null,
  label,
  summary: `Mark ${label} done`,
  scope,
  apply: {
    all: [{ method: "POST", path: `/tasks/${id}/done` }],
    this: [{ method: "POST", path: `/tasks/${id}/done` }],
    following: [{ method: "DELETE", path: `/tasks/${id}/done` }],
  },
  undo: [{ method: "DELETE", path: `/tasks/${id}/done` }],
});

async function say(page: Page, answer: object) {
  await page.route("**/api/voice", (route) => route.fulfill({ json: answer }));
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByLabel("Say or type one sentence").fill("change something");
  await dialog.getByRole("button", { name: "Send" }).click();
  return dialog;
}

test("a change plan is confirmed, saved and undone", async ({ page }) => {
  await signIn(page);
  const id = await addTask(page, "Voice change one");
  const dialog = await say(page, {
    outcome: "change",
    plan: donePlan(id, "Voice change one"),
  });
  await expect(dialog.getByText("Mark Voice change one done")).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await doneAt(page, id)).not.toBeNull();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => doneAt(page, id)).toBeNull();
});

test("choosing the second option applies that plan", async ({ page }) => {
  await signIn(page);
  const a = await addTask(page, "Voice pick A");
  const b = await addTask(page, "Voice pick B");
  const dialog = await say(page, {
    outcome: "choose",
    options: [donePlan(a, "Voice pick A"), donePlan(b, "Voice pick B")],
  });
  await expect(dialog.getByText("Which one?")).toBeVisible();
  await dialog.getByRole("button", { name: "Voice pick B" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => doneAt(page, b)).not.toBeNull();
  expect(await doneAt(page, a)).toBeNull();
});

test("a plan that asks applies the chosen scope", async ({ page }) => {
  await signIn(page);
  const id = await addTask(page, "Voice scope");
  const dialog = await say(page, { outcome: "change", plan: donePlan(id, "Voice scope", "ask") });
  await expect(dialog.getByText("Only this time or from now on?")).toBeVisible();
  await dialog.getByRole("button", { name: "Only this time" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => doneAt(page, id)).not.toBeNull();
});

test("a plan without undo shows no Undo button", async ({ page }) => {
  await signIn(page);
  const id = await addTask(page, "Voice no undo");
  const dialog = await say(page, {
    outcome: "change",
    plan: { ...donePlan(id, "Voice no undo"), undo: null },
  });
  await dialog.getByRole("button", { name: "Save" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

for (const [outcome, message] of [
  ["notFound", "Not found"],
  ["oneAtATime", "One thing at a time, please"],
  ["refused", "Voice Entry doesn't delete; open the item to delete it"],
  ["locked", "A Birthday's date and Person change on the Person"],
] as const) {
  test(`${outcome} shows its message`, async ({ page }) => {
    await signIn(page);
    const dialog = await say(page, { outcome });
    await expect(dialog.getByTestId("voice-notice")).toHaveText(message);
  });
}
