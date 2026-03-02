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

// Read server-config.json for build-time values (avoids hardcoding domains).
// next.config.js is pure JS and can't import @webalive/shared, so we read directly.
// In production, SERVER_CONFIG_PATH is always set and the file always exists.
// In local dev, these stay null/empty — Sentry won't init and contact email is blank.
let sentryConfig = null
let contactEmail = ""
const SENTRY_HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i

function readRequiredString(obj, key, context) {
  const value = obj?.[key]
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`FATAL: ${context}.${key} is missing or empty in server-config.json`)
  }
  return value
}

function normalizeSentryConfig(rawSentry) {
  const dsn = readRequiredString(rawSentry, "dsn", "sentry")
  const org = readRequiredString(rawSentry, "org", "sentry")
  const project = readRequiredString(rawSentry, "project", "sentry")

  const rawUrl = rawSentry?.url
  const rawHost = rawSentry?.host
  let url = ""

  if (typeof rawUrl === "string" && rawUrl.trim() !== "") {
    try {
      url = new URL(rawUrl).toString()
    } catch {
      throw new Error("FATAL: sentry.url must be a valid URL in server-config.json")
    }
  } else if (typeof rawHost === "string" && rawHost.trim() !== "") {
    if (!SENTRY_HOSTNAME_RE.test(rawHost)) {
      throw new Error("FATAL: sentry.host must be a bare hostname (e.g. sentry.example.com)")
    }
    url = `https://${rawHost}`
  } else {
    throw new Error("FATAL: sentry.url is required (or provide legacy sentry.host) in server-config.json")
  }

  return { dsn, org, project, url }
}

{
  const configPath = process.env.SERVER_CONFIG_PATH
  if (configPath && fs.existsSync(configPath)) {
    const serverCfg = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    contactEmail = readRequiredString(serverCfg, "contactEmail", "root")
    if (serverCfg.sentry) sentryConfig = normalizeSentryConfig(serverCfg.sentry)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Separate distDir for test server to avoid conflicts with dev server
  // Tests use ".next-test", dev/prod use ".next"
  distDir: process.env.PLAYWRIGHT_TEST ? ".next-test" : ".next",
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  skipTrailingSlashRedirect: true,
  // PostHog proxy: handled by app/ingest/[...path]/route.ts (not rewrites)
  // so that X-Forwarded-For is preserved for accurate GeoIP.
  // Sentry uses a tunnel API route — see app/api/monitoring/route.ts.
  // Manager v2 is routed directly by Caddy → localhost:5090.
  // Skip Next's internal TS pass to remove duplicate work in `next build`.
  // We run `tsgo --noEmit` via turbo as the single type-safety gate in CI/deploy.
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease,
    NEXT_PUBLIC_STREAM_ENV: process.env.STREAM_ENV || "",
    ...(sentryConfig ? { NEXT_PUBLIC_SENTRY_DSN: sentryConfig.dsn } : {}),
    NEXT_PUBLIC_CONTACT_EMAIL: contactEmail,
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

  // Sentry build config from server-config.json (undefined = disabled)
  org: sentryConfig?.org,
  project: sentryConfig?.project,
  sentryUrl: sentryConfig?.url,
})
