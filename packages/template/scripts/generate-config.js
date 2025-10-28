#!/usr/bin/env bun

// Template configuration generator
// Usage: bun run generate-config.js <domain> <port>

const fs = require("fs")
const path = require("path")

const [domain, port, targetDir] = process.argv.slice(2)

// Determine working directory
const workDir = targetDir || process.cwd()
console.log(`📂 Working in: ${workDir}`)

// Validation
if (!domain || !port) {
  console.error("❌ Usage: bun run generate-config.js <domain> <port> [target-dir]")
  process.exit(1)
}

if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
  console.error(`❌ Invalid domain format: ${domain}`)
  process.exit(1)
}

const portNum = parseInt(port)
if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
  console.error(`❌ Invalid port: ${port} (must be 1024-65535)`)
  process.exit(1)
}

const safeName = domain.replace(/\./g, "-")
const packageName = domain.replace(/\./g, "_")

// Generate vite.config.ts
const viteConfig = `import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	server: {
		host: "::",
		port: ${port},
		allowedHosts: ["${domain}"],
	},
	preview: {
		host: "::",
		port: ${port},
		allowedHosts: ["${domain}"],
	},
	plugins: [react(), mode === "development" && componentTagger()].filter(
		Boolean,
	),
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
}));
`

// Generate systemd-compatible notes (no longer generating PM2 configs)
const systemdNotes = `# This site uses systemd services for security isolation
#
# To deploy this site with full isolation:
# 1. Run: /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh ${domain}
# 2. The systemd service will be created automatically
# 3. Service name: site@${safeName}.service
#
# Manual systemd commands:
# - Start: systemctl start site@${safeName}.service
# - Status: systemctl status site@${safeName}.service
# - Logs: journalctl -u site@${safeName}.service -f
#
# Security features:
# - Runs as user: site-${safeName}
# - Isolated file access
# - Resource limits enforced
# - systemd security hardening active
`

// Validate directories exist
const userDir = path.join(workDir, "user")
if (!fs.existsSync(userDir)) {
  console.error(`❌ user directory not found at: ${userDir}`)
  process.exit(1)
}

// Update package.json
const packageJsonPath = path.join(userDir, "package.json")
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    packageJson.name = packageName
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    console.log(`✅ Updated package.json name to: ${packageName}`)
  } catch (error) {
    console.error(`❌ Failed to update package.json: ${error.message}`)
    process.exit(1)
  }
} else {
  console.warn("⚠️  package.json not found, skipping update")
}

// Write config files with error handling
const viteConfigPath = path.join(userDir, "vite.config.ts")
const systemdNotesPath = path.join(workDir, "SYSTEMD_DEPLOYMENT.md")

try {
  fs.writeFileSync(viteConfigPath, viteConfig)
  console.log(`✅ Generated vite.config.ts for ${domain}:${portNum}`)
} catch (error) {
  console.error(`❌ Failed to write vite.config.ts: ${error.message}`)
  process.exit(1)
}

try {
  fs.writeFileSync(systemdNotesPath, systemdNotes)
  console.log(`✅ Generated systemd deployment notes for ${safeName}`)
} catch (error) {
  console.error(`❌ Failed to write systemd notes: ${error.message}`)
  process.exit(1)
}

console.log(`🚀 Configuration generated for ${domain} on port ${portNum}`)
