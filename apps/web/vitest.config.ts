import { readFileSync } from "node:fs"
import { join } from "node:path"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig, type Plugin, type ViteUserConfig } from "vitest/config"

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

export const sharedConfig = {
  plugins: [tsconfigPaths() as Plugin],
  resolve: {
    preserveSymlinks: false,
    alias: {
      // Point to source, not dist - let TypeScript handle compilation
      "@alive-brug/tools/display": join(process.cwd(), "../../packages/tools/src/display.ts"),
      "@alive-brug/tools": join(process.cwd(), "../../packages/tools/src/index.ts"),
      "@webalive/site-controller": join(process.cwd(), "../../packages/site-controller"),
      "@alive-brug/images": join(process.cwd(), "../../packages/images"),
      "@alive-brug/template": join(process.cwd(), "../../packages/template"),
      "@alive-brug/guides": join(process.cwd(), "../../packages/guides"),
    },
  },
  ssr: {
    noExternal: [
      "@alive-brug/tools",
      "@webalive/site-controller",
      "@alive-brug/images",
      "@alive-brug/template",
      "@alive-brug/guides",
    ],
  },
} satisfies ViteUserConfig

export const baseTestConfig = {
  globals: true,
  setupFiles: ["./tests/setup.ts"],
  env: {
    ...loadEnvFile(),
    BRIDGE_ENV: "local",
  },
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/e2e-tests/**",
    "**/.next/**",
    "**/*.spec.{ts,tsx}",
    "**/lib/__tests__/claude-tool-permissions.test.ts",
  ],
}

export const dbIntegrationGlobs = [
  "lib/credits/__tests__/**/*.integration.test.ts",
  "lib/credits/__tests__/credit-system-supabase.test.ts",
  "lib/__tests__/credit-system-supabase.test.ts",
  "lib/deployment/__tests__/org-resolver.test.ts",
  "lib/deployment/__tests__/user-quotas.test.ts",
  "features/auth/lib/__tests__/rls-integration.test.ts",
]

export const systemGlobs = [
  "features/deployment/__tests__/**/*.test.ts",
  "lib/__tests__/install-package-e2e.test.ts",
  "app/api/login-manager/__tests__/security.test.ts",
]

export default defineConfig({
  ...sharedConfig,
  test: {
    ...baseTestConfig,
    environment: "happy-dom",
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...baseTestConfig.exclude, ...dbIntegrationGlobs, ...systemGlobs],
    testTimeout: 10000, // Fail fast on slow tests
  },
})
