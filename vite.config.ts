import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { releaseNumber } from "./src/core/release-number";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

/**
 * "v1.4.2 (abc1234)" for a deployed build: the release number from main's history, then the
 * commit. Needs the full history (the deploy job checks it out whole); elsewhere it's "dev".
 */
function appVersion(): string {
  const commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) return "dev";
  try {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const base = git("log", "-1", "--format=%H", '-G"version":', "--", "package.json");
    const titles = git("log", "--reverse", "--first-parent", "--format=%s", `${base}..HEAD`);
    return `v${releaseNumber(version, titles ? titles.split("\n") : [])} (${commit})`;
  } catch {
    return commit;
  }
}

export default defineConfig({
  define: {
    // Shown in Settings, error details and the Error Log.
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    react(),
    tailwindcss(),
    // Workers AI only runs on Cloudflare: locally it fails and the Briefing shows its
    // countdown fallback, unless REMOTE_BINDINGS=1 and wrangler is logged in.
    cloudflare({ remoteBindings: process.env.REMOTE_BINDINGS === "1" }),
    VitePWA({
      // A new version waits until every window of the app is closed: it applies on the next
      // open, never in the middle of an edit.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Family Calendar",
        short_name: "Calendar",
        lang: "pt-PT",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f766e",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The app shell only. API answers live in the device's query cache, which is wiped
        // when the device is signed out; the service worker never keeps them.
        // Push and notification-click handling lives in public/push-sw.js.
        importScripts: ["push-sw.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // date-holidays is large and loaded lazily; it must still work offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
