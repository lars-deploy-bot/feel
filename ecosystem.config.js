const config = require("./bridge.config.js")
const { config: loadEnv } = require("dotenv")
const path = require("path")

// Load .env file from project root
loadEnv({ path: path.join(__dirname, ".env") })

/**
 * PM2 Ecosystem Configuration
 *
 * ⚠️  DEPRECATED FOR PRODUCTION & STAGING ⚠️
 * Production and staging now use systemd services instead of PM2.
 * See: /etc/systemd/system/claude-bridge-prod.service
 *      /etc/systemd/system/claude-bridge-staging.service
 *
 * ACTIVE:
 * - dev: Uses PM2 with hot-reload (next dev --turbo)
 * - shell-server: Uses systemd (not PM2)
 *
 * This file is kept for reference but production/staging configs are unused.
 */

module.exports = {
  apps: [
    // DEPRECATED: Use systemd instead (claude-bridge-prod.service)
    {
      name: config.appName.production,
      cwd: "/root/webalive/claude-bridge",
      script: ".builds/prod/current/standalone/apps/web/server.js",
      interpreter: "bun",
      env: {
        PATH: process.env.PATH,
        PORT: String(config.ports.production),
        NODE_ENV: "production",
        WORKSPACE_BASE: config.workspaceBase.production,
        BRIDGE_API_PORT: String(config.ports.production),
        BRIDGE_PASSCODE: process.env.BRIDGE_PASSCODE,
        STRIPE_OAUTH_TOKEN: process.env.STRIPE_OAUTH_TOKEN,
      },
    },
    // DEPRECATED: Use systemd instead (claude-bridge-staging.service)
    {
      name: config.appName.staging,
      cwd: "/root/webalive/claude-bridge",
      script: ".builds/staging/current/standalone/apps/web/server.js",
      interpreter: "bun",
      env: {
        PATH: process.env.PATH,
        PORT: String(config.ports.staging),
        NODE_ENV: "production",
        WORKSPACE_BASE: config.workspaceBase.staging,
        BRIDGE_API_PORT: String(config.ports.staging),
        BRIDGE_PASSCODE: process.env.BRIDGE_PASSCODE,
        STRIPE_OAUTH_TOKEN: process.env.STRIPE_OAUTH_TOKEN,
      },
    },
    // ACTIVE: Dev uses PM2 for hot-reload
    {
      name: config.appName.dev,
      cwd: "/root/webalive/claude-bridge/apps/web",
      script: "node_modules/.bin/next",
      args: `dev --turbo -p ${config.ports.dev}`,
      interpreter: "bun",
      interpreter_args: "--bun",
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "development",
        WORKSPACE_BASE: config.workspaceBase.dev,
        BRIDGE_API_PORT: String(config.ports.dev),
        BRIDGE_PASSCODE: process.env.BRIDGE_PASSCODE,
        STRIPE_OAUTH_TOKEN: process.env.STRIPE_OAUTH_TOKEN,
      },
    },
    // DEPRECATED: shell-server now uses systemd (shell-server.service)
    {
      name: "shell-server",
      cwd: "/root/webalive/claude-bridge/apps/shell-server",
      script: "dist/index.js",
      interpreter: "node",
      env: {
        PATH: process.env.PATH,
        PORT: "3888",
        NODE_ENV: "production",
        WORKSPACE_BASE: config.workspaceBase.dev,
        SHELL_PASSWORD: process.env.SHELL_PASSWORD,
      },
    },
  ],
}
