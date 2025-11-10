const config = require("./bridge.config.js")

module.exports = {
  apps: [
    {
      name: config.appName.production,
      cwd: "/root/webalive/claude-bridge",
      script: ".builds/current/standalone/apps/web/server.js",
      interpreter: "bun",
      env: {
        PORT: String(config.ports.production),
        NODE_ENV: "production",
        WORKSPACE_BASE: config.workspaceBase.production,
        BRIDGE_API_PORT: String(config.ports.production),
      },
    },
    {
      name: config.appName.staging,
      cwd: "/root/webalive/claude-bridge/apps/web",
      script: "bunx",
      args: `next dev --turbo -p ${config.ports.staging}`,
      env: {
        NODE_ENV: "development",
        WORKSPACE_BASE: config.workspaceBase.staging,
        BRIDGE_API_PORT: String(config.ports.staging),
      },
    },
  ],
}
