import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("an Entry opens at once from the calendar, without waiting for its own request", async ({
  page,
}) => {
  await signIn(page);
  const types = await (await page.request.get("/api/entry-types")).json();
  const created = await page.request.post("/api/entries", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      title: "Quick optician",
      entryTypeId: types[0].id,
      time: {
        allDay: false,
        startDate: "2026-11-18",
        startTime: "10:00",
        endDate: "2026-11-18",
        endTime: "11:00",
      },
      personIds: [],
      importance: "normal",
      location: "",
      notes: "",
      reminders: [],
      private: false,
      repetition: null,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const { id } = await created.json();

  await page.goto("/week/2026-11-16");
  const block = page.getByTestId("entry").filter({ hasText: "Quick optician" });
  await expect(block).toBeVisible();
  // The Entry's own request is slow; what the week already holds shows meanwhile.
  await page.route(`**/api/entries/${id}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.continue();
  });
  await block.click();
  const popup = page.getByRole("dialog");
  await expect(popup).toContainText("Quick optician", { timeout: 3_000 });
  await popup.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Quick optician", { timeout: 3_000 });
});
