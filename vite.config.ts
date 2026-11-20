import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { ADS, buildAdFrame, readyUnits } from "./src/config/ads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Emits ad-frame.html, the isolated page that hosts Adsterra scripts inside a
 * sandboxed iframe, so ad code never runs in (or rewrites) the main document.
 */
function adFramePlugin(): Plugin {
  return {
    name: "elementra-ad-frame",
    configureServer(server) {
      server.middlewares.use("/ad-frame.html", (_req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(buildAdFrame());
      });
    },
    generateBundle() {
      if (Object.keys(readyUnits(ADS)).length === 0) return;
      this.emitFile({ type: "asset", fileName: "ad-frame.html", source: buildAdFrame() });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile(), adFramePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
