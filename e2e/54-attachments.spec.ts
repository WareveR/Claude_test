import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
const TITLE = "Pay the IRS x54";
// A 1×1 PNG, as a phone's gallery would hand over a photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.afterEach(async ({ page }) => {
  const tasks = (await (await page.request.get("/api/tasks")).json()) as {
    id: string;
    title: string;
  }[];
  for (const task of tasks.filter((t) => t.title === TITLE)) {
    await page.request.delete(`/api/tasks/${task.id}`, { headers: ORIGIN });
  }
});

test("a new Task takes a file before it is saved, and a photo afterwards", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill(TITLE);
  const box = page.getByTestId("attachments");
  // A computer has no separate camera button: Photos and Files open the file picker.
  await expect(box.getByRole("button", { name: "Take a photo" })).toHaveCount(0);
  await box
    .locator('input[type="file"]')
    .last()
    .setInputFiles({
      name: "guia.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });
  await expect(box).toContainText("guia.pdf");
  await expect(box).toContainText("Added on save");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/tasks\/new$/);

  await page.goto("/tasks");
  await page.getByTestId("task").filter({ hasText: TITLE }).getByRole("link").click();
  // The Task's summary lists what is attached; its page can add and remove.
  const popup = page.getByRole("dialog", { name: TITLE });
  await expect(popup.getByTestId("attachments")).toContainText("guia.pdf");
  await popup.getByRole("link", { name: "Edit" }).click();
  const saved = page.locator("main").getByTestId("attachments");
  const pdf = saved.getByRole("link", { name: /guia\.pdf/ });
  await expect(pdf).toBeVisible();
  const href = await pdf.getAttribute("href");
  const file = await page.request.get(href!);
  expect(file.headers()["content-type"]).toBe("application/pdf");

  await saved
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "recibo.png", mimeType: "image/png", buffer: PNG });
  await expect(saved.getByRole("img", { name: "recibo.png" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await saved.getByRole("button", { name: "Remove recibo.png" }).click();
  await expect(saved.getByRole("img", { name: "recibo.png" })).toHaveCount(0);
});
