import { defineConfig } from "vite";

export default defineConfig({
  base: "/birthday-journey/",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
