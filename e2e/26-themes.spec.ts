import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a theme picked in Settings recolours the app and stays after a reload", async ({ page }) => {
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");

  await page.goto("/settings/device");
  await page.getByLabel("Theme on this device").selectOption({ label: "Spring" });
  await expect(html).toHaveAttribute("data-theme", "spring");
  const header = page.locator("header");
  await expect(header).toHaveCSS("background-color", "rgb(103, 65, 217)");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "spring");

  await page
    .getByLabel("Theme on this device")
    .selectOption({ label: "Automatic (follows the device)" });
  await expect(html).not.toHaveAttribute("data-theme");
});

test("the four themes for different ages each change the look, not only the colours", async ({
  page,
}) => {
  await signIn(page);
  const html = page.locator("html");
  const header = page.locator("header").first();
  const picker = page.getByLabel("Theme on this device");
  await page.goto("/settings/device");

  await picker.selectOption({ label: "Playground (bright, for children)" });
  await expect(html).toHaveAttribute("data-theme", "playground");
  await expect(header).toHaveCSS("background-color", "rgb(214, 51, 108)");
  await expect(picker).toHaveCSS("border-radius", "12px");

  await picker.selectOption({ label: "Neon (dark, for teenagers)" });
  await expect(html).toHaveAttribute("data-theme", "neon");
  await expect(header).toHaveCSS("color", "rgb(46, 242, 255)");
  await expect(picker).toHaveCSS("border-radius", "0px");

  await picker.selectOption({ label: "Paper (calm, serif)" });
  await expect(html).toHaveAttribute("data-theme", "paper");
  await expect(header).toHaveCSS("background-color", "rgb(250, 247, 240)");
  await expect(header).toHaveCSS("font-family", /Georgia|serif/);

  await picker.selectOption({ label: "High contrast (large text)" });
  await expect(html).toHaveAttribute("data-theme", "contrast");
  await expect(header).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(html).toHaveCSS("font-size", "18px");
  await expect(picker).toHaveCSS("border-top-width", "2px");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "contrast");
});

test("the four nature themes lay a material over the page and the header", async ({ page }) => {
  await signIn(page);
  const blocked: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) blocked.push(msg.text());
  });
  const html = page.locator("html");
  const header = page.locator("header").first();
  const picker = page.getByLabel("Theme on this device");
  await page.goto("/settings/device");

  for (const [label, theme, pageTexture, headerTexture] of [
    ["Wood (oak and walnut)", "wood", "oak", "walnut"],
    ["Stone (limestone and slate)", "stone", "limestone", "slate"],
    ["Forest (ferns and leaves)", "forest", "moss", "canopy"],
    ["Cork (a cork board)", "cork", "cork", "dark-cork"],
  ] as const) {
    await picker.selectOption({ label });
    await expect(html).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "background-image",
      new RegExp(`/textures/${pageTexture}\\.webp`),
    );
    await expect(header).toHaveCSS(
      "background-image",
      new RegExp(`/textures/${headerTexture}\\.webp`),
    );
    for (const texture of [pageTexture, headerTexture]) {
      const res = await page.request.get(`/textures/${texture}.webp`);
      expect(res.ok()).toBe(true);
      expect(res.headers()["content-type"]).toBe("image/webp");
    }
  }
  // The calendar stays a near-solid sheet over the material.
  await page.goto("/month/2026-10");
  const sheet = page.locator(".calendar-sheet").first();
  await expect(sheet).toHaveCSS("background-color", /rgba\(255, 253, 248, 0\.86\)|color\(srgb/);
  expect(blocked).toEqual([]);
});
