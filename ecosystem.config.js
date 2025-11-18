const config = require("./bridge.config.js")
const { config: loadEnv } = require("dotenv")
const path = require("path")

// Load .env file from project root
loadEnv({ path: path.join(__dirname, ".env") })

module.exports = {
  apps: [
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
  ],
}
