import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always use ".next" - build script moves it to .builds/dist and copies to standalone
  distDir: ".next",
  output: "standalone",
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Monorepo: trace from project root (two directories up)
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  outputFileTracingIncludes: {
    "/**/*": [
      "packages/tools/**/*",
      "packages/images/**/*",
      "packages/guides/**/*",
      "!packages/guides/guides", // Exclude circular symlink
    ],
  },
  serverExternalPackages: ["@napi-rs/image", "bun:sqlite"],
  transpilePackages: ["@alive-brug/guides", "@alive-brug/images", "@alive-brug/tools"],
}
export default nextConfig
