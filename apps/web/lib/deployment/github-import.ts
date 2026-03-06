/**
 * GitHub Repository Import
 *
 * Downloads a GitHub repo via the API tarball endpoint, extracts it,
 * and restructures it to match the site template layout.
 *
 * Template layout:
 *   /package.json        (workspaces: ["user"], scripts delegate to user/)
 *   /scripts/            (empty dir - no generate-config.js)
 *   /user/               (repo files go here)
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const DOWNLOAD_TIMEOUT_MS = 60_000
const REPO_INFO_TIMEOUT_MS = 15_000
const GITHUB_IMPORT_PREFIX = "/tmp/github-import-"

/**
 * Parsed GitHub repository reference
 */
interface ParsedRepo {
  owner: string
  repo: string
}

/**
 * Resolved repository info from GitHub API
 */
interface RepoInfo {
  defaultBranch: string
  fullName: string
  isPrivate: boolean
}

/**
 * Validate that a repo exists and resolve its default branch via `GET /repos/{owner}/{repo}`.
 *
 * This catches 404 (not found), 401/403 (private / no access) early with clean errors,
 * instead of letting the tarball download fail cryptically.
 */
export async function resolveRepoInfo(owner: string, repo: string, githubToken?: string): Promise<RepoInfo> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REPO_INFO_TIMEOUT_MS)

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  }
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`
  }

  let response: Response
  try {
    response = await fetch(apiUrl, { headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timed out checking repository ${owner}/${repo}. Please try again.`)
    }
    throw new Error(`Could not reach GitHub to verify ${owner}/${repo}. Check your connection.`)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const status = response.status
    if (status === 404) {
      if (githubToken) {
        throw new Error(
          `Repository "${owner}/${repo}" not found. Check the name — if it's private, make sure your connected GitHub account has access.`,
        )
      }
      throw new Error(
        `Repository "${owner}/${repo}" not found. If it's a private repository, connect your GitHub account in Settings > Integrations.`,
      )
    }
    if (status === 401 || status === 403) {
      if (githubToken) {
        throw new Error(
          `Access denied to "${owner}/${repo}". Your GitHub token may have expired — reconnect in Settings > Integrations.`,
        )
      }
      throw new Error(
        `"${owner}/${repo}" appears to be a private repository. Connect your GitHub account in Settings > Integrations to import it.`,
      )
    }
    if (status === 429) {
      throw new Error("GitHub API rate limit exceeded. Please wait a minute and try again.")
    }
    throw new Error(`GitHub returned an unexpected error (${status}) for ${owner}/${repo}.`)
  }

  const data = (await response.json()) as { default_branch?: string; full_name?: string; private?: boolean }

  const defaultBranch = data.default_branch
  if (!defaultBranch) {
    throw new Error(`Could not determine the default branch for ${owner}/${repo}.`)
  }

  return {
    defaultBranch,
    fullName: data.full_name ?? `${owner}/${repo}`,
    isPrivate: data.private ?? false,
  }
}

/**
 * Parse a GitHub repo URL or shorthand into owner/repo.
 *
 * Supported formats:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - owner/repo
 *
 * @throws Error if the format is not recognized
 */
export function parseGithubRepo(repoUrl: string): ParsedRepo {
  const input = repoUrl.trim()
  const invalidFormatMessage =
    `Invalid GitHub repo format: "${repoUrl}". ` +
    'Expected "https://github.com/owner/repo", "https://github.com/owner/repo.git", "git@github.com:owner/repo.git", or "owner/repo".'

  if (!input) {
    throw new Error(invalidFormatMessage)
  }

  const validName = (value: string) => /^[a-zA-Z0-9_.-]+$/.test(value)
  const normalizeRepo = (value: string) => value.replace(/\.git$/i, "")

  // SSH URL format: git@github.com:owner/repo(.git)
  const sshMatch = input.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/)
  if (sshMatch) {
    const owner = sshMatch[1]
    const repo = normalizeRepo(sshMatch[2] ?? "")
    if (!owner || !repo || !validName(owner) || !validName(repo)) {
      throw new Error(`Invalid GitHub URL: could not extract owner/repo from "${repoUrl}"`)
    }
    return { owner, repo }
  }

  // HTTPS URL format: https://github.com/owner/repo(.git)[/...]
  if (input.startsWith("https://")) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(input)
    } catch {
      throw new Error(invalidFormatMessage)
    }

    if (parsedUrl.hostname.toLowerCase() !== "github.com") {
      throw new Error(invalidFormatMessage)
    }

    const pathnameParts = parsedUrl.pathname
      .split("/")
      .map(part => part.trim())
      .filter(Boolean)

    const owner = pathnameParts[0] ?? ""
    const repo = normalizeRepo(pathnameParts[1] ?? "")
    if (!owner || !repo || !validName(owner) || !validName(repo)) {
      throw new Error(`Invalid GitHub URL: could not extract owner/repo from "${repoUrl}"`)
    }

    return { owner, repo }
  }

  // owner/repo shorthand
  const shorthandMatch = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/)
  if (shorthandMatch) {
    const owner = shorthandMatch[1]
    const repo = normalizeRepo(shorthandMatch[2] ?? "")
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repo shorthand: could not extract owner/repo from "${repoUrl}"`)
    }
    return { owner, repo }
  }

  throw new Error(invalidFormatMessage)
}

/**
 * Download and extract a GitHub repository tarball via the API.
 *
 * Uses GET /repos/{owner}/{repo}/tarball/{ref} with Bearer token auth.
 * No git CLI required — pure HTTP + tar extraction.
 *
 * When no branch is specified, resolves the repo's default branch first
 * via the GitHub API. This also validates the repo exists and is accessible,
 * giving clean errors for 404/401/403 before attempting the download.
 *
 * @param repoUrl - GitHub repo URL or owner/repo shorthand
 * @param githubToken - GitHub OAuth token (optional — public repos work without it)
 * @param branch - Optional branch/ref (defaults to repo default branch)
 * @returns Object with path to the extracted repo directory and the resolved branch
 * @throws Error if download or extraction fails
 */
async function downloadGithubRepo(
  repoUrl: string,
  githubToken?: string,
  branch?: string,
): Promise<{ repoDir: string; resolvedBranch: string }> {
  const { owner, repo } = parseGithubRepo(repoUrl)

  // Resolve the default branch if not specified — also validates repo exists
  let ref: string
  if (branch) {
    ref = branch
  } else {
    const repoInfo = await resolveRepoInfo(owner, repo, githubToken)
    ref = repoInfo.defaultBranch
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`

  const tempDir = `${GITHUB_IMPORT_PREFIX}${crypto.randomUUID()}`
  mkdirSync(tempDir, { recursive: true })

  const tarballPath = join(tempDir, "repo.tar.gz")
  const extractDir = join(tempDir, "extracted")
  mkdirSync(extractDir, { recursive: true })

  try {
    // Download tarball via GitHub API
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    }
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`
    }

    const response = await fetch(apiUrl, {
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const status = response.status
      if (status === 404) {
        throw new Error(`Branch "${ref}" not found in ${owner}/${repo}. Check the branch name and try again.`)
      }
      if (status === 401 || status === 403) {
        if (githubToken) {
          throw new Error(
            `Access denied to ${owner}/${repo}. Your GitHub token may have expired — reconnect in Settings > Integrations.`,
          )
        }
        throw new Error(
          `"${owner}/${repo}" appears to be a private repository. Connect your GitHub account in Settings > Integrations to import it.`,
        )
      }
      if (status === 429) {
        throw new Error("GitHub API rate limit exceeded. Please wait a minute and try again.")
      }
      throw new Error(`GitHub returned an unexpected error (${status}) while downloading ${owner}/${repo}.`)
    }

    // Write tarball to disk
    const arrayBuffer = await response.arrayBuffer()
    await Bun.write(tarballPath, arrayBuffer)

    // Extract tarball (tar is universally available, unlike git)
    execFileSync("tar", ["xzf", tarballPath, "-C", extractDir, "--strip-components=1"], {
      timeout: 30_000,
    })

    // The extracted files are now directly in extractDir
    const repoDir = join(tempDir, "repo")
    renameSync(extractDir, repoDir)

    if (!existsSync(repoDir) || readdirSync(repoDir).length === 0) {
      throw new Error(`Downloaded tarball was empty for ${owner}/${repo}`)
    }

    return { repoDir, resolvedBranch: ref }
  } catch (error) {
    // Clean up on failure
    cleanupImportDir(tempDir)

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000}s for ${owner}/${repo}`)
    }

    throw error
  }
}

/**
 * Restructure a downloaded repo directory into the site template layout.
 *
 * Moves repo files into a `user/` subdirectory and creates the root
 * package.json with workspace config (only if user/package.json exists).
 *
 * @param repoDir - Path to the repo files (e.g., /tmp/github-import-<uuid>/repo)
 * @returns Path to the prepared template directory (parent of repoDir)
 */
export function prepareImportedRepo(repoDir: string): string {
  // The template dir is the parent of the repo dir
  const templateDir = join(repoDir, "..")

  const userDir = join(templateDir, "user")

  // Move repo to user/ directory
  renameSync(repoDir, userDir)

  // Remove .git directory from user/ if present (shouldn't be with tarball, but safety)
  const gitDir = join(userDir, ".git")
  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true })
  }

  // Check if user/package.json exists to decide on root package.json
  const userPackageJsonPath = join(userDir, "package.json")
  const hasUserPackageJson = existsSync(userPackageJsonPath)

  if (hasUserPackageJson) {
    // Create root package.json that delegates to user/
    const rootPackageJson = {
      name: "@webalive/imported-site",
      version: "0.0.0",
      private: true,
      workspaces: ["user"],
      scripts: {
        dev: "cd user && bun run dev",
        build: "cd user && bun run build",
        preview: "cd user && bun run preview",
      },
    }

    writeFileSync(join(templateDir, "package.json"), `${JSON.stringify(rootPackageJson, null, 2)}\n`)
  }

  // Create empty scripts/ dir (no generate-config.js, so build script skips vite config generation)
  const scriptsDir = join(templateDir, "scripts")
  mkdirSync(scriptsDir, { recursive: true })

  return templateDir
}

/**
 * Clean up a temporary import directory.
 *
 * @param tempDir - Path to the temp directory to remove
 */
export function cleanupImportDir(tempDir: string): void {
  const resolved = resolve(tempDir)
  // Safety check: only remove directories under our known prefix
  if (!resolved.startsWith(GITHUB_IMPORT_PREFIX)) {
    throw new Error(`Refusing to remove directory outside of import prefix: ${tempDir}`)
  }

  if (existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true })
  }
}

/**
 * Full import flow: download, restructure, return template path.
 *
 * The caller is responsible for calling cleanupImportDir() after deployment completes.
 *
 * @param repoUrl - GitHub repo URL or owner/repo shorthand
 * @param githubToken - GitHub OAuth token (optional — public repos work without it)
 * @param branch - Optional branch to download
 * @returns Object with templatePath and cleanupDir for post-deployment cleanup
 */
export async function importGithubRepo(
  repoUrl: string,
  githubToken?: string,
  branch?: string,
): Promise<{ templatePath: string; cleanupDir: string; resolvedBranch: string }> {
  const { repoDir, resolvedBranch } = await downloadGithubRepo(repoUrl, githubToken, branch)

  // The cleanup dir is the parent (the /tmp/github-import-<uuid>/ dir)
  const cleanupDir = join(repoDir, "..")

  try {
    const templatePath = prepareImportedRepo(repoDir)
    return { templatePath, cleanupDir, resolvedBranch }
  } catch (error) {
    // Clean up on preparation failure
    cleanupImportDir(cleanupDir)
    throw error
  }
}
