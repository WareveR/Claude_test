import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a failure shows a code and details, can be reported and is in the Error log", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/api/tasks", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.goto("/tasks");

  const notice = page.getByRole("alert");
  await expect(notice.getByText("Couldn't load this.")).toBeVisible({ timeout: 15_000 });
  const code = (await notice.getByText(/^ERR-/).textContent())!;
  await notice.getByRole("button", { name: "See details" }).click();
  await expect(notice.getByText("GET /tasks")).toBeVisible();
  await expect(notice.getByText("unavailable")).toBeVisible();

  await notice.getByRole("button", { name: "Report" }).click();
  await notice.getByLabel("What were you doing? (optional)").fill("Opening the Tasks");
  await notice.getByRole("button", { name: "Send" }).click();
  await expect(notice.getByText("Report sent.")).toBeVisible();
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toHaveCount(0);

  await page.unroute("**/api/tasks");
  await page.goto("/settings/account");
  await page.getByRole("link", { name: "Error log" }).click();
  const row = page.getByRole("listitem").filter({ hasText: code });
  await expect(row).toContainText("GET /tasks");
  await expect(row).toContainText("Comment: Opening the Tasks");
});

test("errors that happen offline are logged once back online", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "New task" })).toBeVisible();

  await context.setOffline(true);
  // A crash in the app while there's no connection.
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error("lost while offline");
    }),
  );
  const notice = page.getByRole("alert").filter({ hasText: "Something went wrong in the app." });
  await expect(notice).toBeVisible();
  const code = (await notice.getByText(/^ERR-/).textContent())!;

  await context.setOffline(false);
  await expect(async () => {
    await page.goto("/settings/errors");
    await expect(page.getByRole("listitem").filter({ hasText: code })).toContainText(
      "lost while offline",
      { timeout: 1000 },
    );
  }).toPass();
});
