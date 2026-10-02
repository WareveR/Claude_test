import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".wrangler",
      "node_modules",
      "playwright-report",
      "test-results",
      "src/worker/worker-configuration.d.ts",
      ".agents",
      ".claude",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/app/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
    languageOptions: { globals: globals.browser },
  },
);
