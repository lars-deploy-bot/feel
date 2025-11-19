import { readFileSync } from "node:fs"
import { join } from "node:path"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

// Load .env file manually for tests
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), ".env")
    const envContent = readFileSync(envPath, "utf-8")
    const envVars: Record<string, string> = {}

    for (const line of envContent.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const [, key, value] = match
        // Remove quotes if present
        envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, "")
      }
    }

    return envVars
  } catch {
    return {}
  }
}

export default defineConfig({
  // @ts-expect-error - vite-tsconfig-paths plugin type mismatch between root and vitest bundled vite
  plugins: [tsconfigPaths()],
  resolve: {
    preserveSymlinks: false,
    alias: {
      "@alive-brug/tools": join(process.cwd(), "../../packages/tools"),
      "@alive-brug/deploy-scripts": join(process.cwd(), "../../packages/deploy-scripts"),
      "@alive-brug/images": join(process.cwd(), "../../packages/images"),
      "@alive-brug/template": join(process.cwd(), "../../packages/template"),
      "@alive-brug/guides": join(process.cwd(), "../../packages/guides"),
    },
  },
  ssr: {
    noExternal: [
      "@alive-brug/tools",
      "@alive-brug/deploy-scripts",
      "@alive-brug/images",
      "@alive-brug/template",
      "@alive-brug/guides",
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    env: {
      ...loadEnvFile(),
      BRIDGE_ENV: "local", // Force tests to run against local server
    },
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e-tests/**", // Exclude Playwright e2e tests
      "**/.next/**",
      "**/*.spec.{ts,tsx}", // Exclude all Playwright spec files
      "**/lib/__tests__/claude-tool-permissions.test.ts", // Temporarily exclude - requires .mjs module resolution
    ],
  },
})
