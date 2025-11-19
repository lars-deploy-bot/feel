import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { DeploymentError } from "../orchestration/errors"

const OLD_SITE_BASE_DIR = "/root/webalive/sites"
const NEW_SITE_BASE_DIR = "/srv/webalive/sites"
const ETC_SITES_DIR = "/etc/sites"
const TEMPLATE_PATH = "/root/webalive/claude-bridge/packages/template"

export async function ensureDir(path: string) {
  try {
    await fs.mkdir(path, { recursive: true })
  } catch {
    // Directory already exists
  }
}

export async function copyDir(src: string, dst: string) {
  await ensureDir(dst)

  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name)
    const dstPath = resolve(dst, entry.name)

    if (entry.isSymbolicLink()) {
      // Skip symlinks to prevent circular references and EISDIR errors
      // Symlinks are development artifacts (like node_modules) that shouldn't be deployed
      console.warn(`[Deploy] Skipping symlink: ${entry.name}`)
      continue
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath)
    } else {
      const content = await fs.readFile(srcPath)
      await fs.writeFile(dstPath, content)
    }
  }
}

export async function chownRecursive(path: string, username: string) {
  try {
    const result = spawnSync("id", ["-u", username], { encoding: "utf-8", stdio: "pipe" })
    const uid = result.stdout.trim()
    const chownResult = spawnSync("chown", ["-R", `${uid}:${uid}`, path])
    if (chownResult.error || chownResult.status !== 0) {
      throw new Error("chown failed")
    }
  } catch (error) {
    throw new DeploymentError(`Failed to change ownership: ${error}`)
  }
}

export async function ensureSymlink(source: string, target: string) {
  try {
    await fs.lstat(target)
  } catch {
    await fs.symlink(source, target)
  }
}

export async function createEnvFile(filePath: string, domain: string, port: number) {
  const content = `DOMAIN=${domain}\nPORT=${port}\n`
  await fs.writeFile(filePath, content)
}

export async function setupSiteDirectories(
  domain: string,
  siteUser: string,
): Promise<{ newSiteDir: string; oldSiteDir: string; slug: string }> {
  const slug = domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const newSiteDir = resolve(NEW_SITE_BASE_DIR, domain)
  const oldSiteDir = resolve(OLD_SITE_BASE_DIR, domain)

  // Create directories
  await ensureDir(newSiteDir)
  await ensureDir(ETC_SITES_DIR)

  // Copy site files
  try {
    await fs.stat(oldSiteDir)
    await copyDir(oldSiteDir, newSiteDir)
  } catch {
    await copyDir(TEMPLATE_PATH, newSiteDir)
  }

  // Create symlink for systemd compatibility
  if (domain.includes(".")) {
    const symlinkPath = resolve(NEW_SITE_BASE_DIR, slug)
    await ensureSymlink(domain, symlinkPath)
  }

  // Fix initial ownership
  await chownRecursive(newSiteDir, siteUser)

  return { newSiteDir, oldSiteDir, slug }
}

export { OLD_SITE_BASE_DIR, NEW_SITE_BASE_DIR, ETC_SITES_DIR, TEMPLATE_PATH }
