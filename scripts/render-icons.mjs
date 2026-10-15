// Renders public/icon.svg into the PNG app icons. Run after changing the SVG:
//   node scripts/render-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg").toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0"><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block"></body>`,
  );
  await page.screenshot({ path: `public/${file}`, omitBackground: false });
}
await browser.close();
