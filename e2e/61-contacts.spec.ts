import { expect, test } from "@playwright/test";
import { lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a useful contact is added in Settings and offered on the Entry that names it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/family");
  await page.getByRole("button", { name: "New contact" }).click();
  const dialog = page.getByRole("dialog", { name: "New contact" });
  await dialog.getByLabel("Name").fill("Dr Lopes x61");
  await dialog.getByLabel("Role").fill("Paediatrician");
  await dialog.getByLabel("Phone").fill("+351 912 345 678");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  const line = page.getByTestId("contact").filter({ hasText: "Dr Lopes x61" });
  await expect(line.getByRole("link", { name: "Call Dr Lopes x61" })).toHaveAttribute(
    "href",
    "tel:+351912345678",
  );

  const types = await (await page.request.get("/api/entry-types")).json();
  const entry = (await (
    await page.request.post("/api/entries", {
      headers: ORIGIN,
      data: {
        title: "Paediatrician check-up",
        entryTypeId: types[0].id,
        time: {
          allDay: false,
          startDate: lisbonDate(1),
          startTime: "10:00",
          endDate: null,
          endTime: null,
        },
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
    await page.goto(`/day/${lisbonDate(1)}`);
    await page.getByText("Paediatrician check-up").first().click();
    await expect(
      page.getByTestId("entry-contacts").getByRole("link", { name: "Call Dr Lopes x61" }),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/entries/${entry.id}`, { headers: ORIGIN });
  }

  await page.goto("/settings/family");
  await line.getByRole("button").first().click();
  await page.getByRole("button", { name: "Delete contact" }).click();
  await expect(line).toHaveCount(0);
});
