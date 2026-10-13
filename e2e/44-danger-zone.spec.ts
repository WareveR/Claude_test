import { expect, test } from "@playwright/test";
import { PASSWORD, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

// Only the Error Log is deleted here: every spec shares one Family.
test("the Danger zone checks the password, downloads the Export, then deletes", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/account");
  const zone = page.getByRole("region", { name: "Danger zone" });
  await expect(zone.getByLabel("Family password")).toHaveCount(0);

  await zone.getByRole("checkbox", { name: /Error log/ }).check();
  await zone.getByLabel("Family password").fill("not the password");
  page.once("dialog", (dialog) => dialog.accept());
  await zone.getByRole("button", { name: "Delete 1 part for good" }).click();
  await expect(zone.getByText("Wrong password.", { exact: false })).toBeVisible();

  await zone.getByLabel("Family password").fill(PASSWORD);
  const download = page.waitForEvent("download");
  const reset = page.waitForResponse(
    (res) => res.url().endsWith("/api/reset") && !res.request().postData()?.includes('"check"'),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await zone.getByRole("button", { name: "Delete 1 part for good" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  expect((await reset).status()).toBe(204);
  await expect(zone.getByRole("status")).toHaveText(
    "Deleted. The Export was saved on this device.",
  );

  await zone.getByRole("button", { name: "Tick everything: start again as a new family" }).click();
  await expect(
    zone.getByRole("button", { name: "Delete everything and start again" }),
  ).toBeVisible();
});
