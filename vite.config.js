import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(root, "client") } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.CAMPUSLINK_API_PROXY || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist/client", emptyOutDir: true, sourcemap: false },
  preview: { host: "0.0.0.0", port: 4173 },
});
