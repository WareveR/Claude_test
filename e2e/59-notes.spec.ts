import { expect, test } from "@playwright/test";
import { leaveWall, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a note is put up on the Wall and taken down", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  const board = page.getByTestId("display-board");
  await expect(board).toBeVisible();

  await board.getByRole("button", { name: "Leave a note" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave a note" });
  await dialog.getByLabel("Note").fill("Soup in the fridge x59");
  await dialog.getByRole("radio", { name: "Colour 3" }).click();
  await dialog.getByRole("button", { name: "Tomorrow" }).click();
  await dialog.getByRole("button", { name: "Put up" }).click();

  const note = board.getByTestId("note").filter({ hasText: "Soup in the fridge x59" });
  await expect(note).toBeVisible();
  // Still there after a reload: it was saved.
  await page.reload();
  await expect(note).toBeVisible();

  await note.getByRole("button", { name: 'Take down the note "Soup in the fridge x59"' }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Soup in the fridge x59")).toHaveCount(0);
  await leaveWall(page);
});
