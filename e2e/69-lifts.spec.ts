import { expect, test } from "@playwright/test";
import { lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("an Entry that needs a lift shows on the calendar until someone takes and picks up", async ({
  page,
}) => {
  await signIn(page);
  const person = async (name: string) =>
    (
      (await (
        await page.request.post("/api/persons", {
          headers: ORIGIN,
          data: { name, color: "#c8e6c9", nicknames: [] },
        })
      ).json()) as { id: string }
    ).id;
  const bia = await person("Bia x69");
  const rui = await person("Rui x69");
  const types = await (await page.request.get("/api/entry-types")).json();
  const entry = (await (
    await page.request.post("/api/entries", {
      headers: ORIGIN,
      data: {
        title: "Ballet x69",
        entryTypeId: types[0].id,
        time: {
          allDay: false,
          startDate: lisbonDate(1),
          startTime: "17:00",
          endDate: lisbonDate(1),
          endTime: "18:00",
        },
        personIds: [bia],
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
    await page.goto(`/day/${lisbonDate(1)}`);
    const block = page.getByTestId("entry").filter({ hasText: "Ballet x69" }).first();
    await block.click();
    await page.getByRole("button", { name: "Needs a lift" }).click();
    const box = page.getByTestId("lift");
    await expect(box).toContainText("Nobody to take them yet.");
    await box.getByLabel("Takes").selectOption({ label: "Rui x69" });
    await expect(box).not.toContainText("Nobody to take them yet.");
    await expect(box).toContainText("Nobody to pick them up yet.");
    await page.keyboard.press("Escape");
    await expect(block.getByTestId("lift-missing").first()).toBeVisible();

    await block.click();
    await page.getByTestId("lift").getByLabel("Picks up").selectOption({ label: "Rui x69" });
    await expect(page.getByTestId("lift")).not.toContainText("Nobody to");
    await page.keyboard.press("Escape");
    await expect(block.getByTestId("lift-missing")).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/entries/${entry.id}`, { headers: ORIGIN });
    await page.request.delete(`/api/persons/${bia}`, { headers: ORIGIN });
    await page.request.delete(`/api/persons/${rui}`, { headers: ORIGIN });
  }
});
