import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT ?? 5173);
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";
// The site lives under its own URL path so it can coexist with the Expo app at "/".
const basePath = (process.env.BASE_PATH ?? "/site").replace(/\/+$/, "") + "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    allowedHosts: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  preview: { port, allowedHosts: true },
  build: { outDir: "dist", emptyOutDir: true },
});
