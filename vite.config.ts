import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@scenes": resolve(__dirname, "src/scenes"),
      "@data": resolve(__dirname, "src/data"),
      "@entities": resolve(__dirname, "src/entities"),
      "@ui": resolve(__dirname, "src/ui"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
