import { readAliveToml } from "../alive-toml.js"
import { runScript } from "./common.js"

export interface BuildSiteParams {
  user: string
  domain: string
  port: number
  slug: string
  targetDir: string
  envFilePath: string
}

/**
 * Build a site (install dependencies, run build).
 *
 * If the site has an alive.toml, uses its setup/build commands.
 * Otherwise falls back to legacy behavior (bun install + bun run build).
 */
export async function buildSite(params: BuildSiteParams): Promise<void> {
  const toml = readAliveToml(params.targetDir)

  const env: Record<string, string> = {
    SITE_USER: params.user,
    SITE_DOMAIN: params.domain,
    SITE_PORT: params.port.toString(),
    SITE_SLUG: params.slug,
    TARGET_DIR: params.targetDir,
    ENV_FILE_PATH: params.envFilePath,
  }

  if (toml) {
    console.log(`[build] Found alive.toml (kind=${toml.project.kind}, root=${toml.project.root})`)
    env.ALIVE_TOML = "true"
    env.PROJECT_ROOT = toml.project.root
    env.SETUP_COMMAND = toml.setup.command
    env.BUILD_COMMAND = toml.build.command

    // Resolve run command: prefer production, fall back to development
    const runEntry = toml.run.production ?? toml.run.development
    if (runEntry) {
      env.RUN_COMMAND = runEntry.command
    }
  }

  await runScript("03-build-site.sh", env)
}
