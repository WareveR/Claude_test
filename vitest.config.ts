import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          include: ["src/core/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            // Workers AI is remote-only; tests replace it with a fake (src/worker/ai.ts).
            remoteBindings: false,
            miniflare: {
              bindings: {
                SETUP_CODE: "test-setup-code",
                // Local-only VAPID pair from .dev.vars.example, so tests run on a fresh checkout.
                VAPID_PUBLIC_KEY:
                  "BP-YVRiIWVoBJIPIZA7r8Nw-fdctXup0sb6GNwIctouAvyH2meZz9b8d8AqtMaativsR95XTEy-vnmLBBfyQWeo",
                VAPID_PRIVATE_KEY: "gdWrDjYbXXjpht4mfRPqOJgErQkmORrr6iubA6JcNz0",
                VAPID_SUBJECT: "mailto:calendar@example.com",
                TEST_MIGRATIONS: await readD1Migrations("migrations"),
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["src/worker/**/*.test.ts"],
          setupFiles: ["src/worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
});
