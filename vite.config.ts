import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
  ],
  server: {
    watch: {
      // Prevent full-page reloads when Deno KV writes to local files
      ignored: [
        "../data/**",
        "../../data/**",
      ],
    },
  },
});
