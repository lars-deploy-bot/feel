import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs"

/**
 * NOTE: Environment validation happens in the app itself via:
 * - apps/web/app/layout.tsx (imports @webalive/env)
 * - apps/web/lib/env-validation.ts (can be imported in API routes)
 *
 * This ensures validation runs during build AND runtime.
 * Cannot import TS files here since next.config.js runs in Node before transpilation.
 */

const configDir = path.dirname(fileURLToPath(import.meta.url))
const RIPGREP_TARGETS = ["arm64-darwin", "arm64-linux", "arm64-win32", "x64-darwin", "x64-linux", "x64-win32"]
const ripgrepTarget = `${process.arch}-${process.platform}`
const ripgrepExcludes = RIPGREP_TARGETS.filter(target => target !== ripgrepTarget).map(
  target => `../../node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/${target}/**/*`,
)

// Generate build info file at build time
function writeBuildInfo() {
  try {
    const commit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
    const branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim()
    const buildTime = new Date().toISOString()
    const buildInfo = { commit, branch, buildTime }

    const targetPath = path.join(configDir, "lib", "build-info.json")

    fs.writeFileSync(targetPath, JSON.stringify(buildInfo, null, 2))
  } catch (error) {
    // Log errors but don't fail the build
    // build-info.json is optional and will fall back to "unknown" values
    if (process.env.DEBUG_BUILD_INFO) {
      console.warn(
        "[build-info] Error writing build-info.json:",
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}

writeBuildInfo()

// Read build commit for Sentry release tracking
let sentryRelease = "unknown"
try {
  const buildInfoPath = path.join(configDir, "lib", "build-info.json")
  sentryRelease = JSON.parse(fs.readFileSync(buildInfoPath, "utf-8")).commit ?? "unknown"
} catch {
  // dev mode or build-info not yet written — falls back to "unknown"
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Separate distDir for test server to avoid conflicts with dev server
  // Tests use ".next-test", dev/prod use ".next"
  distDir: process.env.PLAYWRIGHT_TEST ? ".next-test" : ".next",
  output: "standalone",
  devIndicators: false,
  // Required for PostHog proxy rewrites to work correctly
  skipTrailingSlashRedirect: true,
  // Proxy analytics/monitoring through our domain to bypass ad blockers
  async rewrites() {
    const rewrites = []
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "")
    if (posthogHost) {
      rewrites.push(
        { source: "/ingest/static/:path*", destination: `${posthogHost}/static/:path*` },
        { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
      )
    }
    // Sentry uses a tunnel API route (not a rewrite) — see app/api/monitoring/route.ts

    // Manager v2 is routed directly by Caddy → localhost:5090 (no Next.js rewrite needed)

    return rewrites
  },
  // Skip Next's internal TS pass to remove duplicate work in `next build`.
  // We run `tsgo --noEmit` via turbo as the single type-safety gate in CI/deploy.
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease,
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Turbopack: Set root to monorepo root for proper package resolution
  turbopack: {
    root: path.join(configDir, "../../"),
  },
  // Monorepo: trace from project root (two directories up)
  outputFileTracingRoot: path.join(configDir, "../../"),
  outputFileTracingIncludes: {
    "/api/claude/stream/route": [
      // Keep includes surgical. Broad package globs make standalone tracing slow.
      "../../packages/tools/dist/**/*",
      "../../packages/tools/package.json",
      "../../packages/images/dist/**/*",
      "../../packages/images/package.json",
      "../../packages/site-controller/dist/**/*",
      "../../packages/site-controller/scripts/**/*",
      "../../packages/site-controller/package.json",
      "../../packages/worker-pool/dist/**/*",
      "../../packages/worker-pool/src/worker-entry.mjs",
      "../../packages/worker-pool/package.json",
      "../../packages/shared/dist/**/*",
      "../../packages/shared/package.json",
      "../../packages/shared/environments.json",
      "../../packages/database/dist/**/*",
      "../../packages/database/package.json",
      // Child-process dependencies that are not reliably auto-traced
      "../../node_modules/@anthropic-ai/claude-agent-sdk/**/*",
      "../../node_modules/groq-sdk/**/*",
      "../../node_modules/zod/**/*",
    ],
  },
  outputFileTracingExcludes: {
    // TypeScript is pulled in by Next's server trace but is not required for runtime.
    // Keep it out of standalone to shrink final artifact size.
    "/*": ["../../node_modules/typescript/**"],

    // Exclude nested workspace node_modules symlinks from standalone tracing.
    // They can conflict with traced copies and break chunk loading at runtime.
    "/api/claude/stream/route": [
      "../../packages/**/node_modules/**",
      "../../packages/**/.tmp/**",
      "../../packages/**/.turbo/**",
      "../../packages/**/test/**",
      "../../packages/**/docs/**",
      "../../packages/**/__tests__/**",
      // Claude SDK bundles ripgrep binaries for all platforms.
      // Only keep the current build target to reduce standalone size.
      ...ripgrepExcludes,
    ],
  },
  serverExternalPackages: ["@napi-rs/image", "@webalive/site-controller", "@webalive/oauth-core"],
  transpilePackages: [
    "@webalive/images",
    "@webalive/tools",
    "@webalive/shared",
    "@webalive/env",
    "@webalive/worker-pool",
    "@webalive/database",
  ],
}
export default withSentryConfig(nextConfig, {
  // Suppress noisy source map upload logs
  silent: true,

  // Don't upload source maps to Sentry (self-hosted, not needed)
  sourcemaps: { disable: true },

  // Don't widen the tracing for build-time (keeps builds fast)
  webpack: { treeshake: { removeDebugLogging: true } },

  // Use the org/project from our self-hosted Sentry
  org: "sentry",
  project: "alive",

  // Self-hosted Sentry URL
  sentryUrl: "https://sentry.sonno.tech",
})
