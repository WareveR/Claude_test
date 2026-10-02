import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Family downloads a full Export and every Entry as .ics", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await expect(page.getByText("No full Export yet.")).toBeVisible();

  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download everything (ZIP)" }).click();
  const download = await zipDownload;
  expect(download.suggestedFilename()).toMatch(/^family-calendar-\d{4}-\d{2}-\d{2}\.zip$/);

  const files = unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(Object.keys(files)).toContain("data.json");
  const text = new TextDecoder().decode(files["data.json"]);
  expect(JSON.parse(text).format).toBe("family-calendar-export");
  expect(text).toContain("Ana Pires");
  expect(text).not.toContain("password_hash");

  await expect(page.getByText(/^Last full Export: /)).toBeVisible();
  await expect(page.getByText("No full Export yet.")).toHaveCount(0);

  const icsDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download all Entries (.ics)" }).click();
  const ics = await readFile(await (await icsDownload).path(), "utf8");
  expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
});
