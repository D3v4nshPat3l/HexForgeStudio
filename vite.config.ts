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
    // Source maps ship the full TypeScript source alongside the bundle. Useful locally,
    // but this repository is "all rights reserved" -- publishing them on a public
    // deployment would hand over the source. Opt in with SOURCEMAP=1 when debugging.
    sourcemap: process.env.SOURCEMAP === "1",
    chunkSizeWarningLimit: 1200
  },
  worker: { format: "es" }
});
