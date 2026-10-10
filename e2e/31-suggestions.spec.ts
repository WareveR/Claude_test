import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a theme opens its ideas, the box reads phrases, and everything is created after review", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/api/suggestions/read", (route) =>
    route.fulfill({
      json: {
        outcome: "read",
        items: [
          {
            kind: "entry",
            title: "Suggested gym",
            date: "2030-01-07",
            time: "19:00",
            repetition: {
              frequency: "weekly",
              interval: 1,
              weekdays: [0, 2],
              end: { type: "never" },
            },
          },
        ],
      },
    }),
  );
  await page.getByRole("link", { name: "Suggestions" }).click();
  await expect(page.getByRole("heading", { name: "Suggestions", level: 1 })).toBeVisible();

  await page.getByLabel("What repeats?").fill("car, gym on Monday and Wednesday at 7pm");
  await page.getByRole("button", { name: "Read", exact: true }).click();

  // "car" opens the Car ideas; the other phrase went to the model.
  await expect(page.getByRole("heading", { name: "Car" })).toBeVisible();
  await expect(page.getByText("Suggested gym")).toBeVisible();
  await expect(page.getByText("Every week Mon, Wed · 19:00")).toBeVisible();

  await page.getByLabel("Pay the IUC (road tax)").check();
  await page.getByLabel("Car inspection").check();
  await expect(page.getByText("Answer above to work out the dates.")).toBeVisible();
  await page.getByLabel("Registration date").fill("2012-05-20");
  await expect(page.getByText("Answer above to work out the dates.")).toHaveCount(0);

  // A bill paid by direct debit is only a notice.
  await page.getByRole("button", { name: "+ Monthly bills" }).click();
  await page.getByLabel("Pay the water").check();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Pay the water" })
    .getByText("Direct debit")
    .click();

  await page.getByRole("button", { name: "Review and create" }).click();
  const dialog = page.getByRole("dialog", { name: /About to create/ });
  await expect(dialog.getByText("Debit: water")).toBeVisible();
  await expect(dialog.getByText("Car inspection")).toBeVisible();

  // The repetition changes right here, before anything is created.
  await dialog.getByRole("button", { name: "Change Suggested gym" }).click();
  await dialog.getByLabel("Repeats").selectOption("monthly");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog.getByText(/Every month · 19:00 · first on 7 Jan 2030/)).toBeVisible();

  // A changed first date leaves every line where it was.
  const lines = dialog.getByRole("listitem");
  const before = await lines.allInnerTexts();
  await dialog.getByRole("button", { name: "Change Suggested gym" }).click();
  await dialog.getByLabel("First time").fill("2026-12-01");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog.getByText(/first on 1 Dec 2026/)).toBeVisible();
  expect((await lines.allInnerTexts()).map((x) => x.split("\n")[1])).toEqual(
    before.map((x) => x.split("\n")[1]),
  );

  await dialog.getByRole("button", { name: /^Create \d+$/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const done = page.getByRole("status").filter({ hasText: /Created \d+ Tasks and Entries/ });
  await expect(done).toBeVisible();

  // What was created stays marked on its idea.
  await expect(
    page.getByRole("listitem").filter({ hasText: "Car inspection" }).getByText("Already created"),
  ).toBeVisible();

  const tasks = (await (await page.request.get("/api/tasks")).json()) as { title: string }[];
  expect(tasks.map((t) => t.title)).toEqual(
    expect.arrayContaining(["Car inspection", "Pay the IUC (road tax)"]),
  );

  // Undo removes everything that was just created.
  await done.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  const after = (await (await page.request.get("/api/tasks")).json()) as { title: string }[];
  expect(after.filter((t) => t.title.includes("IUC") || t.title === "Car inspection")).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("the page and its review fit the screen", async ({ page }) => {
    await signIn(page);
    await page.goto("/suggestions");
    await page.getByRole("button", { name: "+ Car" }).click();
    await page.getByLabel("Pay the IUC (road tax)").check();
    await page.getByRole("button", { name: "+ Weekly routine" }).click();
    await page.getByLabel("Groceries").check();
    const sideways = await page.evaluate(
      "(() => { window.scrollTo(1000, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; })()",
    );
    expect(sideways).toBe(0);
    if (process.env.SUGGESTIONS_SHOTS) {
      await page.screenshot({ path: `${process.env.SUGGESTIONS_SHOTS}/page.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "Review and create" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Change Groceries" }).click();
    await expect(dialog).toBeInViewport({ ratio: 1 });
    if (process.env.SUGGESTIONS_SHOTS) {
      await page.screenshot({ path: `${process.env.SUGGESTIONS_SHOTS}/review.png` });
    }
  });
});
