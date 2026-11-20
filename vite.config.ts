import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ADS, buildAdFrame, readyUnits } from "./src/config/ads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Emits ad-frame.html, the isolated page that hosts Adsterra scripts inside a
 * sandboxed iframe, so ad code never runs in (or rewrites) the main document.
 */
function adFramePlugin(): Plugin {
  let ssr = false;
  return {
    name: "elementra-ad-frame",
    configResolved(config) {
      ssr = Boolean(config.build.ssr);
    },
    configureServer(server) {
      server.middlewares.use("/ad-frame.html", (_req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(buildAdFrame());
      });
    },
    generateBundle() {
      if (ssr || Object.keys(readyUnits(ADS)).length === 0) return;
      this.emitFile({ type: "asset", fileName: "ad-frame.html", source: buildAdFrame() });
    },
  };
}

// https://vite.dev/config/
// The site is served from the domain root, so pages at any depth
// (/element/iron) share the same absolute /assets/ URLs.
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), adFramePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
