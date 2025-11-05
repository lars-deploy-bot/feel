/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production: use "dist" for atomic builds
  // Development: use ".next" to avoid conflicts with staging dev server
  distDir: process.env.NODE_ENV === "production" ? "dist" : ".next",
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  serverExternalPackages: ["@napi-rs/image"],
  transpilePackages: ["@alive-brug/guides", "@alive-brug/images", "@alive-brug/tools"],
}
export default nextConfig
