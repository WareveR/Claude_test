import { expect, test } from "@playwright/test";
import { signIn, lisbonDate } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("Refresh writes the countdown list, whose Entries open in a popup", async ({ page }) => {
  await signIn(page);
  await page.goto(`/entries/new?date=${lisbonDate(1)}&time=09:30`);
  await page.getByLabel("Title").fill("Dentist checkup");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Book the vet");
  await page.getByLabel("Due date (optional)").fill(lisbonDate(1));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/summary");
  const band = page.getByTestId("coming-up");
  await expect(band).toContainText("No briefing yet");
  await band.getByRole("button", { name: "Refresh" }).click();
  const line = band.getByTestId("briefing-line").filter({ hasText: "Book the vet · tomorrow" });
  await expect(line).toBeVisible();
  // A Task is plain text; the Tasks are a tap away below.
  await expect(line.getByRole("button")).toHaveCount(0);

  const entry = band.getByTestId("briefing-line").getByRole("button", { name: /Dentist checkup/ });
  await entry.click();
  const popup = page.getByRole("dialog", { name: "Dentist checkup" });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("09:30");
  await popup.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await entry.click();
  await page.getByRole("dialog").getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/entries\/[^/]+\?occurrence=/);
});

test("Play reads the Briefing aloud, greeting first, and Stop ends it", async ({ page }) => {
  // The browser's voice is replaced by one that writes down what it says; after the greeting it
  // hangs on the next sentence, so Stop can be seen.
  await page.addInitScript(`
    window.spoken = [];
    let current = null;
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(u) {
          window.spoken.push(u.text);
          current = u;
          if (window.spoken.length < 2) setTimeout(() => u.onend && u.onend(), 0);
        },
        cancel() { if (current && current.onerror) current.onerror(); current = null; },
        getVoices: () => [],
      },
    });
  `);
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Book the vet");
  await page.getByLabel("Due date (optional)").fill(lisbonDate(1));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/summary");
  const band = page.getByTestId("coming-up");
  await expect(band.getByRole("button", { name: "Play" })).toHaveCount(0);
  await band.getByRole("button", { name: "Refresh" }).click();
  await expect(band.getByTestId("briefing-line").first()).toBeVisible();
  await band.getByRole("button", { name: "Play" }).click();
  await expect(band.getByRole("button", { name: "Stop" })).toBeVisible();
  const spoken = () => page.evaluate<string[]>("window.spoken");
  await expect.poll(spoken).toEqual([
    expect.stringMatching(/^Good (morning|afternoon|evening)!$/),
    // The first countdown line, whichever is most pressing, without its "·".
    expect.stringMatching(/^[^·]+, (today|tomorrow|in \d+ days|\d+ days? overdue) \(/),
  ]);
  await band.getByRole("button", { name: "Stop" }).click();
  await expect(band.getByRole("button", { name: "Play" })).toBeVisible();
});

test("Coming up is on the Summary, not beside the views", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("day-column-" + lisbonDate(0))).toBeVisible();
  await expect(page.getByTestId("coming-up")).toHaveCount(0);
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  await page.getByTestId("display-board").getByRole("button", { name: "Summary" }).click();
  const panel = page.getByTestId("coming-up");
  await expect(panel.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(panel.getByTestId("briefing-line").first()).toBeVisible();
});
