import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's items, shop and Entries all carry this mark.
const MARK = "x43";
const SHOP = `Loja${MARK}`;

async function cleanUp(page: Page) {
  const items = (await (await page.request.get("/api/shopping/items")).json()) as {
    id: string;
    name: string;
  }[];
  for (const item of items.filter((i) => i.name.endsWith(MARK))) {
    await page.request.delete(`/api/shopping/items/${item.id}`, { headers: ORIGIN });
  }
  const entries = (await (
    await page.request.get("/api/entries?from=2026-11-01&to=2026-11-30")
  ).json()) as { id: string; title: string }[];
  for (const entry of entries.filter((e) => e.title.includes(MARK))) {
    await page.request.delete(`/api/entries/${entry.id}`, { headers: ORIGIN });
  }
}

async function newEntry(page: Page, title: string, date: string) {
  await page.goto("/week/2026-11-16");
  await page.getByRole("link", { name: "New", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "General" });
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\/new/);
}

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("a shopping Entry shows the Shopping List instead of a list of its own", async ({ page }) => {
  await signIn(page);
  for (const item of [
    { name: `Bananas ${MARK}`, quantity: "6", note: "", store: "" },
    { name: `Leite ${MARK}`, quantity: "2", note: "", store: SHOP },
  ]) {
    const res = await page.request.post("/api/shopping/items", { headers: ORIGIN, data: item });
    expect(res.ok()).toBe(true);
  }

  await newEntry(page, `Supermercado ${MARK}`, "2026-11-18");
  // Only the Entry is on the calendar; no list was made with it.
  const day = page
    .getByTestId("day-column-2026-11-18")
    .getByTestId("entry")
    .filter({ hasText: MARK });
  await expect(day).toHaveCount(1);
  await day.click();
  const summary = page.getByTestId("entry-summary");
  const shopping = summary.getByTestId("entry-shopping");
  await expect(shopping.getByRole("heading", { name: "Shopping list" })).toBeVisible();
  await expect(shopping.getByRole("listitem").filter({ hasText: `Bananas ${MARK}` })).toContainText(
    "6",
  );
  await expect(shopping).toContainText(`Leite ${MARK}`);
  await expect(shopping.getByRole("checkbox")).toHaveCount(0);
  // No one-off list was made for it.
  await expect(summary.getByTestId("preparation")).toHaveCount(0);
  const entries = (await (
    await page.request.get("/api/entries?from=2026-11-01&to=2026-11-30")
  ).json()) as { id: string; title: string }[];
  const entryId = entries.find((e) => e.title === `Supermercado ${MARK}`)!.id;
  const lists = (await (await page.request.get("/api/checklists")).json()) as {
    entryId: string | null;
  }[];
  expect(lists.filter((l) => l.entryId === entryId)).toEqual([]);

  // The Entry's own page shows it too.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByTestId("entry-shopping")).toContainText(`Bananas ${MARK}`);

  // Naming a shop narrows it to that shop's items and those for any shop, and so does the link.
  await newEntry(page, `Compras ${SHOP}`, "2026-11-19");
  await page
    .getByTestId("day-column-2026-11-19")
    .getByTestId("entry")
    .filter({ hasText: SHOP })
    .click();
  const atShop = page.getByTestId("entry-summary").getByTestId("entry-shopping");
  await expect(atShop.getByRole("heading", { level: 3 })).toHaveText(`Shopping list · ${SHOP}`);
  await expect(atShop).toContainText(`Leite ${MARK}`);
  await expect(atShop).toContainText(`Bananas ${MARK}`);
  await atShop.getByRole("link", { name: "Open shopping list" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(
    page.getByTestId("shopping-stores").getByRole("button", { name: SHOP }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("shopping-stores").getByRole("button", { name: "All" }).click();
});

test("a shopping Entry with nothing to buy says so", async ({ page }) => {
  await signIn(page);
  await newEntry(page, `Groceries ${MARK}`, "2026-11-20");
  await page
    .getByTestId("day-column-2026-11-20")
    .getByTestId("entry")
    .filter({ hasText: MARK })
    .click();
  const shopping = page.getByTestId("entry-summary").getByTestId("entry-shopping");
  await expect(shopping.getByRole("link", { name: "Open shopping list" })).toBeVisible();
  const open = (await (await page.request.get("/api/shopping/items")).json()) as {
    boughtAt: string | null;
  }[];
  if (open.every((i) => i.boughtAt)) {
    await expect(shopping).toContainText("The shopping list is empty");
  }
});
