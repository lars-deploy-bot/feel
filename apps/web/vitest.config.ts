import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig, type Plugin, type ViteUserConfig } from "vitest/config"

const require = createRequire(import.meta.url)
// Resolve React paths via module resolution instead of hardcoding node_modules layout.
// Bun doesn't always hoist packages to the workspace root, so ../../node_modules/react may not exist.
const reactDir = dirname(require.resolve("react/package.json"))
const reactDomDir = dirname(require.resolve("react-dom/package.json"))

// Load .env.staging file manually for tests.
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), ".env.staging")
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
  // Restrict tsconfig resolution to this app so vitest doesn't scan build artifacts under .builds/*
  plugins: [tsconfigPaths({ projects: [join(process.cwd(), "tsconfig.json")], ignoreConfigErrors: true }) as Plugin],
  resolve: {
    preserveSymlinks: false,
    // Use development builds for testing (required for React act() and testing-library)
    conditions: ["development", "browser"],
    alias: {
      // Point to source, not dist - let TypeScript handle compilation
      "@webalive/oauth-core/providers/google": join(process.cwd(), "../../packages/oauth-core/src/providers/google.ts"),
      "@webalive/oauth-core/providers/microsoft": join(
        process.cwd(),
        "../../packages/oauth-core/src/providers/microsoft.ts",
      ),
      // Point workspace packages to source so tests don't depend on stale dist/
      "@webalive/shared/constants": join(process.cwd(), "../../packages/shared/src/constants.ts"),
      "@webalive/shared/database": join(process.cwd(), "../../packages/shared/src/database/index.ts"),
      "@webalive/shared/environments": join(process.cwd(), "../../packages/shared/src/environments.ts"),
      "@webalive/shared/invite-code": join(process.cwd(), "../../packages/shared/src/invite-code.ts"),
      "@webalive/shared/manager-types": join(process.cwd(), "../../packages/shared/src/manager-types.ts"),
      "@webalive/shared/models": join(process.cwd(), "../../packages/shared/src/models.ts"),
      "@webalive/shared/path-security": join(process.cwd(), "../../packages/shared/src/path-security.ts"),
      "@webalive/shared/sdk-message-tool-metadata": join(
        process.cwd(),
        "../../packages/shared/src/sdk-message-tool-metadata.ts",
      ),
      "@webalive/shared/tools": join(process.cwd(), "../../packages/shared/src/tools/stream-tools.ts"),
      "@webalive/shared": join(process.cwd(), "../../packages/shared/src/index.ts"),
      "@webalive/tools/display": join(process.cwd(), "../../packages/tools/src/display.ts"),
      "@webalive/tools": join(process.cwd(), "../../packages/tools/src/index.ts"),
      "@webalive/site-controller": join(process.cwd(), "../../packages/site-controller"),
      "@webalive/images": join(process.cwd(), "../../packages/images"),
      "@webalive/template": join(process.cwd(), "../../packages/template"),
      // Ensure single React copy for DOM testing environments (prevents "Invalid hook call" errors)
      react: reactDir,
      "react-dom": reactDomDir,
      "react/jsx-dev-runtime": join(reactDir, "jsx-dev-runtime.js"),
      "react/jsx-runtime": join(reactDir, "jsx-runtime.js"),
    },
  },
  // Dedupe React to prevent multiple copies
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  ssr: {
    noExternal: [
      "@webalive/tools",
      "@webalive/site-controller",
      "@webalive/images",
      "@webalive/template",
      // Process React in SSR for proper jsdom integration
      "react",
      "react-dom",
    ],
  },
} satisfies ViteUserConfig

export const baseTestConfig = {
  globals: true,
  setupFiles: ["./tests/setup.ts"],
  env: {
    ...loadEnvFile(),
    STREAM_ENV: "local",
  },
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/e2e-tests/**",
    "**/.next/**",
    "**/.next-test/**",
    "**/*.spec.{ts,tsx}",
  ],
  // Use forks instead of threads - module mocking (vi.doMock/vi.resetModules) breaks
  // with threads due to shared module cache, and @napi-rs/image hangs with threads.
  pool: "forks" as const,
  // 4 parallel forks: cuts wall time ~44% (109s → 62s) while leaving cores free.
  maxWorkers: 4,
  // Timeouts
  testTimeout: 10000,
  hookTimeout: 10000,
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
    // Vitest 4.x: Use 'node' environment by default for Node.js built-ins (AsyncLocalStorage)
    // Tests that need DOM can use: // @vitest-environment happy-dom
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...baseTestConfig.exclude, ...dbIntegrationGlobs, ...systemGlobs],
  },
})
