/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  serverExternalPackages: ["@napi-rs/image"],
}
export default nextConfig
