import path from "node:path"

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
  // Monorepo: trace from project root (two directories up)
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/claude/stream/route": [
      "../../packages/tools/**/*",
      "../../packages/images/**/*",
      "../../packages/guides/**/*",
      "../../packages/deploy-scripts/**/*",
      // packages/tools dependencies (used in child process, not auto-traced)
      "../../node_modules/@anthropic-ai/**/*",
      "../../node_modules/groq-sdk/**/*",
      "../../node_modules/zod/**/*",
    ],
  },
  serverExternalPackages: ["@napi-rs/image"],
  transpilePackages: ["@alive-brug/guides", "@alive-brug/images", "@alive-brug/tools", "@alive-brug/deploy-scripts"],
}
export default nextConfig
