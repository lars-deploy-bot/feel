/**
 * Sanitize environment variables for subprocess execution after privilege drop.
 *
 * When parent process runs as root and spawns child that drops to workspace user
 * (setuid/setgid), inherited environment variables can point to root-owned paths
 * that become inaccessible, causing failures.
 *
 * This function clears cache/config directories that point to root-owned paths
 * which become inaccessible after privilege drop, and ensures subprocess can
 * write to /tmp.
 *
 * **Use this for all subprocess execution in workspace tools.**
 *
 * @returns Sanitized environment object safe for subprocess execution
 *
 * @example
 * ```typescript
 * const result = spawnSync("bun", ["add", "lodash"], {
 *   cwd: workspaceRoot,
 *   env: sanitizeSubprocessEnv(),
 *   shell: false,
 * })
 * ```
 */
export function sanitizeSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,

    // System: Ensure subprocess can write to /tmp
    TMPDIR: "/tmp",

    // Bun: Clear cache directory that might point to /root/.bun/install/cache
    // After clearing, bun falls back to $HOME/.bun/install/cache which points
    // to /tmp/claude-home-{uid}/.bun/install/cache (workspace-owned)
    BUN_INSTALL_CACHE_DIR: undefined,

    // NPM (future-proofing): Clear npm cache/config that might point to /root
    NPM_CONFIG_CACHE: undefined,
    NPM_CONFIG_PREFIX: undefined,

    // PNPM (future-proofing): Clear pnpm home directory
    PNPM_HOME: undefined,

    // Yarn (future-proofing): Clear yarn cache directory
    YARN_CACHE_FOLDER: undefined,

    // Keep all other environment variables as-is
  }
}
