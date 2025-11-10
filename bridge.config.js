/**
 * Claude Bridge Configuration
 *
 * ⚠️  SINGLE SOURCE OF TRUTH - All ports and paths defined here
 *
 * To change a port:
 *   1. Edit this file
 *   2. Run: pm2 delete all && pm2 start ecosystem.config.js
 *   3. Run: pm2 save
 *
 * Used by:
 *   - ecosystem.config.js (PM2 processes)
 *   - scripts/build-and-serve.sh (production deployment)
 *   - package.json scripts (npm commands)
 *   - apps/web/package.json (Next.js commands)
 */

const config = {
  // Port configuration
  // Production: Public terminal.goalive.nl
  // Staging: For testing before deployment
  ports: {
    production: 8999,
    staging: 8998,
    dev: 8999,
  },

  // Workspace paths
  // Secure: /srv/webalive/sites (systemd-managed, isolated users)
  // Legacy: /root/webalive/sites (PM2-managed, should migrate)
  workspaceBase: {
    production: "/srv/webalive/sites",
    staging: "/srv/webalive/sites",
    dev: process.env.LOCAL_TEMPLATE_PATH || "/srv/webalive/sites",
  },

  // PM2 process names
  appName: {
    production: "claude-bridge",
    staging: "claude-bridge-staging",
  },
}

// Validation
function validateConfig() {
  const ports = Object.values(config.ports)
  if (ports.some(p => typeof p !== "number" || p < 1024 || p > 65535)) {
    throw new Error("Invalid port configuration: ports must be numbers between 1024-65535")
  }

  if (config.ports.production === config.ports.staging) {
    throw new Error("Production and staging ports must be different")
  }

  const paths = Object.values(config.workspaceBase)
  if (paths.some(p => typeof p !== "string" || !p.startsWith("/"))) {
    throw new Error("Invalid workspace paths: must be absolute paths")
  }
}

validateConfig()

module.exports = config
