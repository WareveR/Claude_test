import { expect, test, type Page } from "@playwright/test";
import { openView, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's items all end in this mark.
const MARK = "x41";

async function cleanUp(page: Page) {
  const items = (await (await page.request.get("/api/shopping/items")).json()) as {
    id: string;
    name: string;
  }[];
  for (const item of items.filter((i) => i.name.endsWith(MARK))) {
    await page.request.delete(`/api/shopping/items/${item.id}`, { headers: ORIGIN });
  }
}

function itemRow(page: Page, name: string) {
  return page.getByTestId("shopping-item").filter({ hasText: name });
}

async function addItem(page: Page, name: string) {
  const box = page.getByRole("combobox", { name: "Add to the list" });
  await box.fill(name);
  await box.press("Enter");
  await expect(itemRow(page, name)).toBeVisible();
  await expect(box).toHaveValue("");
}

async function setDetails(page: Page, name: string, details: { quantity?: string; shop?: string }) {
  await page.getByRole("button", { name: `Details of ${name}` }).click();
  const editor = page.getByTestId("shopping-editor");
  if (details.quantity !== undefined) await editor.getByLabel("Quantity").fill(details.quantity);
  if (details.shop !== undefined) await editor.getByLabel("Shop").fill(details.shop);
  // The list updates at once; wait for the server too, so a reload finds the change.
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/shopping/items/") && r.request().method() === "PATCH",
  );
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);
  expect((await saved).ok()).toBe(true);
}

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("the Shopping List adds items into sections, filters by shop and ticks what is bought", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Shopping", exact: true }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();

  await addItem(page, `Bananas ${MARK}`);
  await addItem(page, `Detergente ${MARK}`);
  await addItem(page, `Leite ${MARK}`);
  await addItem(page, `Pão ${MARK}`);
  await setDetails(page, `Leite ${MARK}`, { quantity: "2", shop: `Lidl ${MARK}` });
  await expect(itemRow(page, `Leite ${MARK}`)).toContainText("· 2");
  await expect(itemRow(page, `Leite ${MARK}`)).toContainText(`Lidl ${MARK}`);
  await setDetails(page, `Pão ${MARK}`, { shop: `Aldi ${MARK}` });

  // Each item sits under its section, worked out from its name.
  await expect(page.getByRole("region", { name: "Fruit and veg" })).toContainText(
    `Bananas ${MARK}`,
  );
  await expect(page.getByRole("region", { name: "Cleaning" })).toContainText(`Detergente ${MARK}`);
  await expect(page.getByRole("region", { name: "Dairy and eggs" })).toContainText(`Leite ${MARK}`);
  await expect(page.getByRole("region", { name: "Bakery" })).toContainText(`Pão ${MARK}`);

  // One shop: its items and those for any shop, remembered on this device.
  const shops = page.getByRole("group", { name: "Shop" });
  await shops.getByRole("button", { name: `Lidl ${MARK}` }).click();
  await expect(shops.getByRole("button", { name: `Lidl ${MARK}` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(itemRow(page, `Leite ${MARK}`)).toBeVisible();
  await expect(itemRow(page, `Bananas ${MARK}`)).toBeVisible();
  await expect(itemRow(page, `Pão ${MARK}`)).toHaveCount(0);
  await page.reload();
  await expect(itemRow(page, `Leite ${MARK}`)).toBeVisible();
  await expect(itemRow(page, `Pão ${MARK}`)).toHaveCount(0);
  await shops.getByRole("button", { name: "All", exact: true }).click();
  await expect(itemRow(page, `Pão ${MARK}`)).toBeVisible();

  // A tap ticks it bought, with an Undo; tapping again puts it back.
  await itemRow(page, `Bananas ${MARK}`).getByText(`Bananas ${MARK}`).click();
  const bought = page.getByRole("region", { name: "Bought" });
  await expect(bought).toContainText(`Bananas ${MARK}`);
  await expect(page.getByRole("checkbox", { name: `Bought: Bananas ${MARK}` })).toBeChecked();
  const toast = page.getByRole("status").filter({ hasText: `Bought: Bananas ${MARK}` });
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("region", { name: "Fruit and veg" })).toContainText(
    `Bananas ${MARK}`,
  );
  await expect(page.getByRole("checkbox", { name: `Bought: Bananas ${MARK}` })).not.toBeChecked();
  await page.getByRole("checkbox", { name: `Bought: Bananas ${MARK}` }).check();
  await expect(bought).toContainText(`Bananas ${MARK}`);
  await itemRow(page, `Bananas ${MARK}`).getByText(`Bananas ${MARK}`).click();
  await expect(page.getByRole("region", { name: "Fruit and veg" })).toContainText(
    `Bananas ${MARK}`,
  );

  // Removing: with the bin button (and an Undo), or by swiping the item sideways.
  await page.getByRole("button", { name: `Remove Detergente ${MARK}` }).click();
  await expect(itemRow(page, `Detergente ${MARK}`)).toHaveCount(0);
  await page
    .getByRole("status")
    .filter({ hasText: `Removed: Detergente ${MARK}` })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(itemRow(page, `Detergente ${MARK}`)).toBeVisible();
  await page.getByRole("button", { name: `Remove Detergente ${MARK}` }).click();
  await expect(itemRow(page, `Detergente ${MARK}`)).toHaveCount(0);

  const row = itemRow(page, `Pão ${MARK}`);
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4 - 200, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(row).toHaveCount(0);
  // The next removal deleted the one before for good.
  await expect
    .poll(async () => {
      const items = (await (await page.request.get("/api/shopping/items")).json()) as {
        name: string;
      }[];
      return items.some((i) => i.name === `Detergente ${MARK}`);
    })
    .toBe(false);

  // Typing offers names from earlier lists; picking one puts it back with its shop.
  await page.getByRole("checkbox", { name: `Bought: Leite ${MARK}` }).check();
  await expect(bought).toContainText(`Leite ${MARK}`);
  const addBox = page.getByRole("combobox", { name: "Add to the list" });
  await addBox.fill("leite x4");
  const option = page.getByRole("option", { name: new RegExp(`Leite ${MARK}`) });
  await expect(option).toContainText(`Lidl ${MARK}`);
  await option.click();
  await expect(page.getByRole("region", { name: "Dairy and eggs" })).toContainText(`Leite ${MARK}`);
  await expect(itemRow(page, `Leite ${MARK}`)).toContainText(`Lidl ${MARK}`);

  // The history lists what was bought, by day.
  await page.getByRole("checkbox", { name: `Bought: Bananas ${MARK}` }).check();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("region", { name: "History" })).toContainText(`Bananas ${MARK}`);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("the Shopping List never scrolls sideways", async ({ page }) => {
    await signIn(page);
    await openView(page, "Shopping");
    await addItem(page, `Queijo da serra amanteigado curado de ovelha ${MARK}`);
    await setDetails(page, `Queijo da serra amanteigado curado de ovelha ${MARK}`, {
      quantity: "1 kg",
      shop: `Mercearia do bairro ${MARK}`,
    });
    await addItem(page, `Ovos ${MARK}`);
    await page.getByRole("checkbox", { name: `Bought: Ovos ${MARK}` }).check();
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(360);
    const sideways = await page.evaluate(
      "(() => { window.scrollTo(1000, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; })()",
    );
    expect(sideways).toBe(0);
  });
});
