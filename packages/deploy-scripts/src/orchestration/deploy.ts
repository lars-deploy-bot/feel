/**
 * Deployment Orchestration
 *
 * Coordinates all deployment steps using modular components:
 * - DNS validation
 * - Port management
 * - System user creation
 * - File operations
 * - Caddy configuration
 * - systemd service setup
 */

import { execSync, spawnSync } from "child_process"
import { promises as fs } from "fs"
import { resolve } from "path"

import { validateDNS, shouldSkipDNSValidation } from "../dns"
import { getOrAssignPort } from "../ports"
import { createSiteCaddyfile, updateCaddyfile } from "../caddy"
import { setupSiteDirectories, chownRecursive, createEnvFile, ETC_SITES_DIR } from "../files"
import { ensureUser, getSiteUsername } from "../users"
import { reloadSystemd, startService, verifyService, stopPM2Service, reloadCaddy, getServiceName } from "../systemd"
import { DeploymentError } from "./errors"
import type { DeploymentConfig, DeploymentResult } from "./types"
import { delay, isPortListening } from "./utils"

/**
 * Validate and clean template: removes circular symlinks that cause EISDIR errors
 * Prevents deployment failures during template copying
 */
async function validateTemplate() {
  const TEMPLATE_PATH = "/root/webalive/claude-bridge/packages/template"
  try {
    const entries = await fs.readdir(TEMPLATE_PATH, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        const symPath = resolve(TEMPLATE_PATH, entry.name)
        const target = await fs.readlink(symPath)
        // Check for self-referential symlinks
        if (target.includes(TEMPLATE_PATH)) {
          console.warn(`[Deploy] Found circular symlink in template: ${entry.name} -> ${target}. Removing it.`)
          // Remove the circular symlink to prevent EISDIR errors
          try {
            await fs.unlink(symPath)
            console.warn(`[Deploy] Removed circular symlink: ${entry.name}`)
          } catch (unlinkError) {
            console.warn(`[Deploy] Could not remove symlink: ${unlinkError}`)
          }
        } else {
          console.warn(`[Deploy] Warning: Symlink in template: ${entry.name} -> ${target}`)
        }
      }
    }
  } catch (error) {
    if (error instanceof DeploymentError) throw error
    // Template validation failures shouldn't block deployment, just warn
    console.warn(`[Deploy] Could not validate template: ${error}`)
  }
}

export async function deploySite(config: DeploymentConfig): Promise<DeploymentResult> {
  if (!config.email) {
    throw new DeploymentError("DEPLOY_EMAIL is required")
  }

  const domain = config.domain.toLowerCase()

  // Validate template is safe before deploying
  await validateTemplate()

  // 1. Validate DNS
  if (!shouldSkipDNSValidation(domain)) {
    await validateDNS(domain)
  }

  // 2. Assign port
  const port = await getOrAssignPort(domain)

  // 3. Setup users and directories
  const slug = domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const siteUser = getSiteUsername(domain)
  await ensureUser(siteUser, resolve("/srv/webalive/sites", domain))

  const { newSiteDir } = await setupSiteDirectories(domain, siteUser)

  // 4. Create site Caddyfile
  await createSiteCaddyfile(newSiteDir, domain, port)

  // 5. Generate configuration
  const configScript = resolve(newSiteDir, "scripts/generate-config.js")
  try {
    await fs.stat(configScript)
  } catch {
    throw new DeploymentError("Config generator not found")
  }

  try {
    const result = spawnSync("bun", ["run", "scripts/generate-config.js", domain, String(port)], {
      cwd: newSiteDir,
      stdio: "inherit",
    })
    if (result.error || result.status !== 0) {
      throw new Error("Config generation failed")
    }
  } catch (error) {
    throw new DeploymentError(`Config generation failed: ${error}`)
  }

  // 6. Fix ownership again after config
  await chownRecursive(newSiteDir, siteUser)

  // 7. Install dependencies and build
  const userDir = resolve(newSiteDir, "user")
  const installResult = spawnSync("sudo", ["-u", siteUser, "bun", "install"], {
    cwd: userDir,
    stdio: "inherit",
  })
  if (installResult.error || installResult.status !== 0) {
    throw new DeploymentError("Dependency installation failed")
  }

  // Fix binary permissions: make .bin executables and esbuild accessible
  // Note: node_modules is at site root, not in user/ subdirectory
  console.log("[Deploy] Fixing binary permissions in node_modules...")
  const chmodResult = spawnSync("bash", ["-c", `find "${resolve(newSiteDir, "node_modules")}" -type f \\( -name "esbuild" -o -path "*/.bin/*" \\) -exec chmod a+x {} \\;`], {
    stdio: "inherit",
  })
  if (chmodResult.error || chmodResult.status !== 0) {
    console.warn("[Deploy] Warning: Failed to fix some binary permissions, build may fail")
  } else {
    console.log("[Deploy] Binary permissions fixed successfully")
  }

  const buildResult = spawnSync("sudo", ["-u", siteUser, "bun", "run", "build"], {
    cwd: userDir,
    stdio: "inherit",
  })
  if (buildResult.error || buildResult.status !== 0) {
    throw new DeploymentError("Build failed")
  }

  // 8. Stop old PM2 process
  await stopPM2Service(domain)

  // 9. Create environment file BEFORE starting service
  // This ensures systemd reads the correct PORT from the env file
  const serviceName = getServiceName(slug)
  const envFile = resolve(ETC_SITES_DIR, `${serviceName.replace("site@", "").replace(".service", "")}.env`)
  await createEnvFile(envFile, domain, port)
  console.log(`[Deploy] ✅ Created ${envFile} with PORT=${port}`)

  // 10. Start systemd service
  await reloadSystemd()
  await startService(serviceName)

  // 11. Verify service
  await delay(3000)
  await verifyService(serviceName)

  // 12. Verify port with retry logic (Vite takes time to start)
  await delay(2000)
  let retries = 3
  let portListening = false
  while (retries > 0) {
    if (await isPortListening(port)) {
      console.log(`[Deploy] ✅ Service listening on port ${port}`)
      portListening = true
      break
    }
    retries--
    if (retries > 0) {
      console.log(`[Deploy] Port ${port} not ready, retrying... (${retries} attempts left)`)
      await delay(2000)
    }
  }

  if (!portListening) {
    const logs = execSync(`journalctl -u ${serviceName} --lines=20`).toString()
    throw new DeploymentError(`Service not listening on port ${port} after 3 retries\n${logs}`)
  }

  // 13. Update main Caddyfile
  await updateCaddyfile(domain, port)

  // 14. Reload Caddy
  await reloadCaddy()

  // 15. Final verification
  await delay(2000)
  try {
    spawnSync("curl", ["-f", "-s", "-I", `https://${domain}`], { stdio: "pipe" })
  } catch {
    // Site might not be ready yet
  }

  return {
    domain,
    port,
    serviceName,
    siteUser,
    siteDirectory: newSiteDir,
    envFile,
    success: true,
  }
}

