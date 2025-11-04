module.exports = {
  apps: [
    {
      name: 'claude-bridge',
      cwd: '/root/webalive/claude-bridge/apps/web',
      script: 'bun',
      args: 'next start -p 8999',
      env: {
        NODE_ENV: 'production',
        WORKSPACE_BASE: '/srv/webalive/sites'
      }
    },
    {
      name: 'claude-bridge-staging',
      cwd: '/root/webalive/claude-bridge/apps/web',
      script: 'bunx',
      args: 'next dev --turbo -p 8998',
      env: {
        NODE_ENV: 'development',
        WORKSPACE_BASE: '/srv/webalive/sites'
      }
    }
  ]
}
