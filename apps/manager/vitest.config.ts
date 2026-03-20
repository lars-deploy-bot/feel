import { mergeConfig } from "vite"
import { defineConfig } from "vitest/config"
import viteConfig from "./vite.config"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      exclude: ["src/__tests__/e2e/**", "node_modules/**"],
    },
  }),
)
