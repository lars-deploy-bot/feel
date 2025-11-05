/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always use ".next" - build script moves it to .builds/dist and copies to standalone
  distDir: ".next",
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  serverExternalPackages: ["@napi-rs/image"],
  transpilePackages: ["@alive-brug/guides", "@alive-brug/images", "@alive-brug/tools"],
}
export default nextConfig
