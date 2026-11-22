import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT ?? 5173);
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

export default defineConfig({
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
