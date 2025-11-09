import react from "@vitejs/plugin-react-swc"
import { componentTagger } from "lovable-tagger"
import path from "node:path"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
// Docker-specific configuration with HMR over WSS
// This file is auto-generated during deployment by scripts/generate-config.js
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      protocol: "wss",
      host: "your-domain.com", // Will be replaced during deployment
      port: 443,
      path: "/__vite_hmr",
    },
    fs: {
      strict: true,
      allow: ["/app"],
    },
    cors: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
