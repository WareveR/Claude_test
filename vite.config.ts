import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    // Shown in error details and the Error Log; the commit being deployed.
    __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev"),
  },
  plugins: [react(), tailwindcss(), cloudflare()],
});
