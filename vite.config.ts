import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const emptyModule = fileURLToPath(new URL("./src/stubs/empty-module.ts", import.meta.url));

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      // See src/stubs/empty-module.ts -- jsPDF's HTML path is never used here.
      html2canvas: emptyModule,
      dompurify: emptyModule
    }
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1200
  },
  worker: { format: "es" }
});
