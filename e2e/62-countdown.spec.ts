import { expect, test } from "@playwright/test";
import { leaveWall, lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("an Entry marked to count the days shows on the Wall", async ({ page }) => {
  await signIn(page);
  const types = await (await page.request.get("/api/entry-types")).json();
  const day = lisbonDate(2);
  const entry = (await (
    await page.request.post("/api/entries", {
      headers: ORIGIN,
      data: {
        title: "Trip x62",
        entryTypeId: types[0].id,
        time: { allDay: true, startDate: day, endDate: day },
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
    })
  ).json()) as { id: string };
  try {
    await page.goto(`/day/${day}`);
    await page.getByText("Trip x62").first().click();
    const mark = page.getByRole("button", { name: "Count the days on the Wall" });
    await mark.click();
    await expect(mark).toHaveAttribute("aria-pressed", "true");

    await page.goto("/");
    await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
    const strip = page.getByTestId("countdowns");
    await expect(strip).toContainText("Trip x62· 2 days");
    // Christmas shows only among the soonest three: other tests' Birthdays may come first.
    await leaveWall(page);
  } finally {
    await page.request.delete(`/api/entries/${entry.id}`, { headers: ORIGIN });
  }
});
