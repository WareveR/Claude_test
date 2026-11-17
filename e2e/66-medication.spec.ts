import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a Person's medication is added with its times and each dose is ticked taken", async ({
  page,
}) => {
  await signIn(page);
  const bia = (
    (await (
      await page.request.post("/api/persons", {
        headers: ORIGIN,
        data: { name: "Bia x66", color: "#c8e6c9", nicknames: [] },
      })
    ).json()) as { id: string }
  ).id;
  try {
    await page.goto(`/settings/persons/${bia}`);
    const section = page.getByTestId("person-medications");
    await section.getByRole("button", { name: "Add medication" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Medication", exact: true }).fill("Ben-u-ron x66");
    await dialog.getByRole("textbox", { name: "Dose", exact: true }).fill("5 ml");
    await dialog.getByLabel("Time 1").fill("08:00");
    await dialog.getByRole("button", { name: "Another time" }).click();
    await dialog.getByLabel("Time 2").fill("20:00");
    await expect(dialog.getByRole("checkbox", { name: /Private/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const morning = section.getByRole("button", { name: "Ben-u-ron x66 at 08:00 taken" });
    await expect(morning).toHaveAttribute("aria-pressed", "false");
    await morning.click();
    await expect(morning).toHaveAttribute("aria-pressed", "true");

    await page.goto("/summary");
    const today = page.getByTestId("today-doses");
    await expect(today).toContainText("Ben-u-ron x66");
    await expect(
      today.getByRole("button", { name: "Ben-u-ron x66 at 08:00 taken" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      today.getByRole("button", { name: "Ben-u-ron x66 at 20:00 taken" }),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    await page.request.delete(`/api/persons/${bia}`, { headers: ORIGIN });
  }
});
