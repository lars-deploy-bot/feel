import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/__tests__/**", "src/types/**"],
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
})
