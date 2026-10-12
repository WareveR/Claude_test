import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("each signed-in device shows its kind, when it signed in and a short ID", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/account");
  const me = page.getByTestId("device-row").filter({ hasText: "this device" });
  // The device found itself to be a computer; the Family can say it is a laptop.
  const kind = me.getByRole("combobox", { name: /^Kind of / });
  await expect(kind).toHaveValue("computer");
  await expect(me).toContainText("Signed in");
  await expect(me).toContainText(/ID [A-Z0-9_-]{6}/);
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/devices/") && r.request().method() === "PATCH",
  );
  await kind.selectOption("laptop");
  await saved;
  await page.reload();
  await expect(me.getByRole("combobox", { name: /^Kind of / })).toHaveValue("laptop");
});
