import { expect, test, type Request } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

// April 2028's grid runs from Monday 27 March to Sunday 30 April.
const NEXT_MONTH = "from=2028-03-27&to=2028-04-30";

test("the next month is loaded ahead, so its Entries show at once on Next", async ({ page }) => {
  await signIn(page);
  const types = await (await page.request.get("/api/entry-types")).json();
  const created = await page.request.post("/api/entries", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      title: "Prefetched dentist",
      entryTypeId: types[0].id,
      time: {
        allDay: false,
        startDate: "2028-04-12",
        startTime: "10:00",
        endDate: "2028-04-12",
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

  // Once March has loaded, April is asked for without being opened.
  const prefetched = page.waitForResponse(
    (res) => res.url().includes(`/api/entries?${NEXT_MONTH}`) && res.ok(),
  );
  await page.goto("/month/2028-03");
  await prefetched;
  await page.waitForLoadState("networkidle");

  const asked: string[] = [];
  const record = (request: Request) => {
    if (request.url().includes("/api/entries?")) asked.push(request.url());
  };
  page.on("request", record);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/month\/2028-04/);
  await expect(page.getByTestId("month-day-2028-04-12")).toContainText("Prefetched dentist", {
    timeout: 3_000,
  });
  page.off("request", record);
  expect(asked.filter((url) => url.includes(NEXT_MONTH))).toEqual([]);
});
