import path from "node:path"

/**
 * NOTE: Environment validation happens in the app itself via:
 * - apps/web/app/layout.tsx (imports @webalive/env)
 * - apps/web/lib/env-validation.ts (can be imported in API routes)
 *
 * This ensures validation runs during build AND runtime.
 * Cannot import TS files here since next.config.js runs in Node before transpilation.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Separate distDir for test server to avoid conflicts with dev server
  // Tests use ".next-test", dev/prod use ".next"
  distDir: process.env.PLAYWRIGHT_TEST ? ".next-test" : ".next",
  output: "standalone",
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Turbopack: Set root to monorepo root for proper package resolution
  turbopack: {
    root: path.join(import.meta.dirname, "../../"),
  },
  // Monorepo: trace from project root (two directories up)
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/claude/stream/route": [
      "../../packages/tools/**/*",
      "../../packages/images/**/*",
      "../../packages/guides/**/*",
      "../../packages/site-controller/**/*",
      // packages/tools dependencies (used in child process, not auto-traced)
      "../../node_modules/@anthropic-ai/**/*",
      "../../node_modules/groq-sdk/**/*",
      "../../node_modules/zod/**/*",
    ],
  },
  serverExternalPackages: ["@napi-rs/image", "@webalive/shared", "@webalive/site-controller", "@webalive/env"],
  transpilePackages: ["@alive-brug/guides", "@alive-brug/images", "@alive-brug/tools"],
}
export default nextConfig
