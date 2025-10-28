import react from "@vitejs/plugin-react-swc"
import { componentTagger } from "lovable-tagger"
import path from "node:path"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: "all",
  },
  preview: {
    host: "::",
    port: 8080, // Will be overridden by config generator
    allowedHosts: ["*"], // Allow any host for template flexibility
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
