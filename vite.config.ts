import { defineConfig } from "vite";

// GitHub Pages serves the site from /chaos-garden/. Dev uses the same base
// so asset URLs match the production build.
export default defineConfig({
  base: "/chaos-garden/",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
