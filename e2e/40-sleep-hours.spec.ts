import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

type SleepHours = { start: number; end: number };

async function sleepHours(page: Page): Promise<SleepHours> {
  const status = await (await page.request.get("/api/status")).json();
  return status.family.sleepHours;
}

async function setSleepHours(page: Page, sleepHours: SleepHours) {
  const res = await page.request.put("/api/family/sleep", {
    headers: ORIGIN,
    data: { sleepHours },
  });
  expect(res.ok()).toBe(true);
}

async function addEntry(page: Page, title: string, startDate: string, startTime: string) {
  const types = await (await page.request.get("/api/entry-types")).json();
  const res = await page.request.post("/api/entries", {
    headers: ORIGIN,
    data: {
      title,
      entryTypeId: types[0].id,
      time: { allDay: false, startDate, startTime, endDate: null, endTime: null },
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
  return ((await res.json()) as { id: string }).id;
}

async function rowHeight(page: Page, hour: number) {
  return (await page.getByTestId(`hour-row-${hour}`).boundingBox())!.height;
}

/** The hour row whose top sits at the top of the scrolling hours. */
async function expectTopRow(page: Page, hour: number) {
  const scroller = page.getByTestId("time-scroller");
  await expect
    .poll(async () => {
      const top = (await scroller.boundingBox())!.y;
      return Math.round((await page.getByTestId(`hour-row-${hour}`).boundingBox())!.y - top);
    })
    .toBe(0);
}

test("Sleeping Hours are half height, grow back with an Entry and follow Family settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  const original = await sleepHours(page);
  await setSleepHours(page, { start: 23, end: 7 });
  const title = `Night flight ${Date.now()}`;
  let id: string | null = null;
  try {
    // An empty day opens at the wake-up hour, with the night rows half as high.
    await page.goto("/day/2031-05-14");
    await expect(page.getByTestId("hour-row-3")).toHaveAttribute("data-sleep", "true");
    expect(await rowHeight(page, 3)).toBeCloseTo(22, 0);
    expect(await rowHeight(page, 23)).toBeCloseTo(22, 0);
    expect(await rowHeight(page, 10)).toBeCloseTo(44, 0);
    await expectTopRow(page, 7);

    // An Entry at 02:00 brings its row back to full height across the week, which opens
    // with the row before it at the top.
    id = await addEntry(page, title, "2031-05-13", "02:00");
    await page.goto("/week/2031-05-12");
    await expect(page.getByTestId("day-column-2031-05-13").getByText(title)).toBeVisible();
    await expect.poll(() => rowHeight(page, 2)).toBeCloseTo(44, 0);
    expect(await rowHeight(page, 1)).toBeCloseTo(22, 0);
    await expectTopRow(page, 1);

    // Other hours set in Settings › Family apply at once.
    await page.goto("/settings/family");
    const section = page.getByTestId("sleep-section");
    let saved = page.waitForResponse((r) => r.url().endsWith("/api/family/sleep") && r.ok());
    await section.getByLabel("Bedtime").selectOption("21");
    await saved;
    saved = page.waitForResponse((r) => r.url().endsWith("/api/family/sleep") && r.ok());
    await section.getByLabel("Wake-up").selectOption("6");
    await saved;
    await page.goto("/day/2031-05-15");
    await expect(page.getByTestId("hour-row-21")).toHaveAttribute("data-sleep", "true");
    expect(await rowHeight(page, 21)).toBeCloseTo(22, 0);
    expect(await rowHeight(page, 6)).toBeCloseTo(44, 0);
    await expect(page.getByTestId("hour-row-6")).not.toHaveAttribute("data-sleep");
    await expectTopRow(page, 6);
  } finally {
    if (id) await page.request.delete(`/api/entries/${id}`, { headers: ORIGIN });
    await setSleepHours(page, original);
  }
});
