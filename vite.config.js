import { defineConfig } from "vite";
export default defineConfig({
  base: "/banners-of-history/",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
