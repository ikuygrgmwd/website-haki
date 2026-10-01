import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: { ignored: ["**/.browser-check/**", "**/.npm-cache/**"] },
  },
});
