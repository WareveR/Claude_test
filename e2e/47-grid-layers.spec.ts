import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

async function addEntry(page: Page, title: string, time: object) {
  const types = await (await page.request.get("/api/entry-types")).json();
  const res = await page.request.post("/api/entries", {
    headers: ORIGIN,
    data: {
      title,
      entryTypeId: types[0].id,
      time,
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
  });
  expect(res.ok()).toBe(true);
}

test("the day and week views show All-day Entries, Timed ones, or both", async ({ page }) => {
  await signIn(page);
  const day = "2031-06-11";
  await addEntry(page, "Layers trip", { allDay: true, startDate: day, endDate: day });
  await addEntry(page, "Layers dentist", {
    allDay: false,
    startDate: day,
    startTime: "10:00",
    endDate: day,
    endTime: "11:00",
  });

  await page.goto("/week/2031-06-09");
  const allDay = page.getByTestId("all-day-row");
  const hours = page.getByTestId("time-scroller");
  const button = page.getByTestId("grid-layers");
  await expect(allDay).toContainText("Layers trip");
  await expect(hours).toContainText("Layers dentist");
  await expect(button).toHaveAttribute("data-layers", "both");

  // Only All-day: the bars take the room and the hours go.
  await button.click();
  await expect(button).toHaveAttribute("data-layers", "allDay");
  await expect(allDay).toContainText("Layers trip");
  await expect(hours).toBeHidden();

  // Only Timed: the bars go and the hours come back.
  await button.click();
  await expect(button).toHaveAttribute("data-layers", "timed");
  await expect(allDay).toBeHidden();
  await expect(hours).toContainText("Layers dentist");

  // Remembered on this device, by the day view too.
  await page.goto(`/day/${day}`);
  await expect(page.getByTestId("grid-layers")).toHaveAttribute("data-layers", "timed");
  await expect(page.getByTestId("all-day-row")).toBeHidden();

  // Back to both.
  await page.getByTestId("grid-layers").click();
  await expect(page.getByTestId("grid-layers")).toHaveAttribute("data-layers", "both");
  await expect(page.getByTestId("all-day-row")).toContainText("Layers trip");
  await expect(page.getByTestId("time-scroller")).toContainText("Layers dentist");
});
