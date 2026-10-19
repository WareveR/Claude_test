import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { MAJOR_STARTS, RELEASE_HISTORY } from "./src/core/release-history";
import { releaseList, releaseNumber } from "./src/core/release-number";
import { RELEASE_NOTES_PT } from "./src/core/release-notes-pt";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

/**
 * "v0.4.2 (abc1234)" for a deployed build: the version number from main's history
 * (src/core/release-number.ts), then the commit. Needs the whole history (the deploy job checks
 * it out whole); elsewhere it's "dev".
 */
function appVersion(): string {
  const commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) return "dev";
  try {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const major = Number(version.split(".")[0]) || 0;
    const start = MAJOR_STARTS[major];
    const lines = git(
      "log",
      "--reverse",
      "--first-parent",
      "--format=%H %s",
      ...(start ? [`${start}..HEAD`] : ["HEAD"]),
    );
    const commits = lines.split("\n").map((line) => {
      const space = line.indexOf(" ");
      return { id: line.slice(0, space), title: line.slice(space + 1) };
    });
    return `v${releaseNumber(major, commits, RELEASE_HISTORY)} (${commit})`;
  } catch {
    return commit;
  }
}

/**
 * Every version with the day it reached main and what it brought, for the list in Settings; empty
 * where the history isn't all there.
 */
function releases(): string {
  try {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const major = Number(version.split(".")[0]) || 0;
    const start = MAJOR_STARTS[major];
    // One record per commit: id, day, title and message body, split by unlikely separators.
    const out = git(
      "log",
      "--reverse",
      "--first-parent",
      "--format=%H%x1f%cs%x1f%s%x1f%b%x1e",
      ...(start ? [`${start}..HEAD`] : ["HEAD"]),
    );
    const commits = out
      .split("\x1e")
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [id, date, title, body = ""] = record.split("\x1f");
        return { id, date, title, body };
      });
    return JSON.stringify(releaseList(major, commits, RELEASE_HISTORY, RELEASE_NOTES_PT));
  } catch {
    return "[]";
  }
}

/** A build for the test copy of the app (wrangler.jsonc's "testes" environment). */
const testSite = process.env.CLOUDFLARE_ENV === "testes";

export default defineConfig({
  define: {
    // Shown in Settings, error details and the Error Log.
    __APP_VERSION__: JSON.stringify(appVersion()),
    // src/app/environment.ts: the test tools show on the test copy and in the e2e build only.
    __TEST_SITE__: JSON.stringify(testSite),
    __DEV_TOOLS__: JSON.stringify(testSite || process.env.DEV_TOOLS === "1"),
  },
  plugins: [
    {
      // The version list Settings shows, fetched only when it is opened.
      name: "releases",
      generateBundle() {
        if (this.environment.name !== "client") return;
        this.emitFile({ type: "asset", fileName: "releases.json", source: releases() });
      },
    },
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
        // The test copy installs under its own name, so the two can't be mixed up on a phone.
        name: testSite ? "Family Calendar (testes)" : "Family Calendar",
        short_name: testSite ? "Testes" : "Calendar",
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
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // date-holidays is large and loaded lazily; it must still work offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
