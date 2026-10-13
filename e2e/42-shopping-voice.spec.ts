import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's items all end in this mark.
const MARK = "x42";

async function listNames(page: Page) {
  const items = (await (await page.request.get("/api/shopping/items")).json()) as {
    name: string;
    boughtAt: string | null;
  }[];
  return items
    .filter((i) => i.name.endsWith(MARK) && !i.boughtAt)
    .map((i) => i.name)
    .sort();
}

async function cleanUp(page: Page) {
  const items = (await (await page.request.get("/api/shopping/items")).json()) as {
    id: string;
    name: string;
  }[];
  for (const item of items.filter((i) => i.name.endsWith(MARK))) {
    await page.request.delete(`/api/shopping/items/${item.id}`, { headers: ORIGIN });
  }
}

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("a sentence to Voice Entry puts things on the Shopping List, with Undo and a link to it", async ({
  page,
}) => {
  await signIn(page);
  await page.request.post("/api/shopping/items", {
    headers: ORIGIN,
    data: { name: `Ovos ${MARK}` },
  });

  const say = async (sentence: string) => {
    await page.getByRole("button", { name: "Voice Entry" }).click();
    const dialog = page.getByRole("dialog", { name: "Voice Entry" });
    await dialog.getByLabel("Say or type one sentence").fill(sentence);
    await dialog.getByRole("button", { name: "Send" }).click();
    return dialog;
  };

  const dialog = await say(`comprar leite ${MARK}, ovos ${MARK} e pão ${MARK}`);
  await expect(dialog.getByTestId("voice-summary")).toHaveText(
    `Add to the shopping list: Leite ${MARK}, Pão ${MARK}`,
  );
  // Already open on the list: not added twice.
  await expect(dialog.getByTestId("voice-notice")).toHaveText(
    `Already on the shopping list: Ovos ${MARK}`,
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(toast).toBeVisible();
  await expect
    .poll(() => listNames(page))
    .toEqual([`Leite ${MARK}`, `Ovos ${MARK}`, `Pão ${MARK}`]);

  // Undo takes away what was just added, and only that.
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => listNames(page)).toEqual([`Ovos ${MARK}`]);

  // In English too; the toast opens the Shopping List.
  const again = await say(`add bread ${MARK} and milk ${MARK} to the shopping list`);
  await expect(again.getByTestId("voice-summary")).toHaveText(
    `Add to the shopping list: Bread ${MARK}, Milk ${MARK}`,
  );
  await again.getByRole("button", { name: "Save" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved" })
    .getByRole("link", { name: "Open shopping list" })
    .click();
  await expect(page).toHaveURL(/\/shopping$/);
  const rows = page.getByTestId("shopping-item");
  await expect(rows.filter({ hasText: `Bread ${MARK}` })).toBeVisible();
  await expect(rows.filter({ hasText: `Milk ${MARK}` })).toBeVisible();
});

test("a purchase with a day and a time is still an Entry", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog
    .getByLabel("Say or type one sentence")
    .fill(`comprar bilhetes ${MARK} para o cinema sábado às 20h`);
  await dialog.getByRole("button", { name: "Send" }).click();
  // The model isn't there locally, so the plain Entry form opens with the sentence.
  await expect(page).toHaveURL(/\/entries\/new$/);
  expect(await listNames(page)).toEqual([]);
});

test("the Suggestions box puts things to buy on the Shopping List, with Undo", async ({ page }) => {
  await signIn(page);
  let modelAsked = false;
  await page.route("**/api/suggestions/read", (route) => {
    modelAsked = true;
    return route.fulfill({ json: { outcome: "failed" } });
  });
  await page.goto("/suggestions");

  const box = page.getByLabel("What repeats?");
  const read = page.getByRole("button", { name: "Read", exact: true });
  const create = async () => {
    await box.fill(`buy butter ${MARK}, cheese ${MARK} and jam ${MARK}`);
    await read.click();
    await expect(page.getByTestId("suggestions-shopping")).toHaveText(
      `Add to the shopping list: Butter ${MARK}, Cheese ${MARK}, Jam ${MARK}`,
    );
    await page.getByRole("checkbox", { name: `Jam ${MARK}` }).uncheck();
    await page.getByRole("button", { name: "Review and create" }).click();
    const dialog = page.getByRole("dialog", { name: /About to create 2/ });
    await expect(dialog.getByTestId("review-shopping")).toHaveText(
      `Add to the shopping list: Butter ${MARK}, Cheese ${MARK}`,
    );
    await dialog.getByRole("button", { name: "Create 2" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const banner = page
      .getByRole("status")
      .filter({ hasText: `Added to the shopping list: Butter ${MARK}, Cheese ${MARK}` });
    await expect(banner).toBeVisible();
    await expect.poll(() => listNames(page)).toEqual([`Butter ${MARK}`, `Cheese ${MARK}`]);
    return banner;
  };

  const banner = await create();
  expect(modelAsked).toBe(false);
  await banner.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => listNames(page)).toEqual([]);

  const next = await create();
  await next.getByRole("link", { name: "Open shopping list" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(
    page.getByTestId("shopping-item").filter({ hasText: `Cheese ${MARK}` }),
  ).toBeVisible();
});
