/**
 * Claude Bridge Configuration (Legacy Wrapper)
 *
 * ⚠️  READS FROM: environments.json (single source of truth)
 *
 * This file loads configuration from environments.json and exposes it in the
 * legacy format for backward compatibility with existing code.
 *
 * Usage:
 *   - const config = require('./bridge.config.js')
 *   - config.ports.production, config.appName.dev, config.workspaceBase.production
 */

const fs = require('fs')
const path = require('path')

// Load from environments.json (single source of truth)
const envPath = path.join(__dirname, 'environments.json')
const rawConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const environments = rawConfig.environments

// Transform to legacy format
const config = {
  // Port configuration
  ports: {
    production: environments.production.port,
    staging: environments.staging.port,
    dev: environments.dev.port,
  },

  // Workspace paths
  workspaceBase: {
    production: environments.production.workspacePath,
    staging: environments.staging.workspacePath,
    dev: environments.dev.workspacePath,
  },

  // Process/service names (systemd for prod/staging, PM2 for dev)
  appName: {
    production: environments.production.processName,
    staging: environments.staging.processName,
    dev: environments.dev.processName,
  },
}

// Validation
function validateConfig() {
  const ports = Object.values(config.ports)
  if (ports.some(p => typeof p !== "number" || p < 1024 || p > 65535)) {
    throw new Error("Invalid port configuration: ports must be numbers between 1024-65535")
  }

  if (config.ports.production === config.ports.dev) {
    throw new Error("Production and dev ports must be different")
  }

  const paths = Object.values(config.workspaceBase)
  if (paths.some(p => typeof p !== "string" || !p.startsWith("/"))) {
    throw new Error("Invalid workspace paths: must be absolute paths")
  }
}

validateConfig()

module.exports = config
