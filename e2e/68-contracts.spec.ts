import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a bill paid by hand brings a Task to pay it, one by direct debit a notice on the Summary", async ({
  page,
}) => {
  await signIn(page);
  const day = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", day: "numeric" }).format(
      new Date(),
    ),
  );
  await page.goto("/settings/family");
  const section = page.getByRole("region", { name: "Bills and contracts" });
  const add = async (name: string, payment: "By hand" | "Direct debit") => {
    await section.getByRole("button", { name: "Add a bill or contract" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
    await dialog.getByLabel("Amount (€)").fill("45,50");
    await dialog.getByLabel("Pay day").fill(String(day));
    await dialog.getByRole("radio", { name: new RegExp(`^${payment}`) }).check();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  await add("Electricity x68", "By hand");
  await add("Internet x68", "Direct debit");
  await expect(section.getByTestId("contract")).toHaveCount(2);

  await page.goto("/tasks");
  await expect(page.getByTestId("task").filter({ hasText: "Pay Electricity x68" })).toBeVisible();
  await expect(page.getByTestId("task").filter({ hasText: "Internet x68" })).toHaveCount(0);

  await page.goto("/summary");
  await expect(page.getByTestId("contract-notices")).toContainText("Internet x68 direct debit");

  const contracts = (await (await page.request.get("/api/contracts")).json()) as { id: string }[];
  for (const { id } of contracts) {
    await page.request.delete(`/api/contracts/${id}`, { headers: ORIGIN });
  }
});
