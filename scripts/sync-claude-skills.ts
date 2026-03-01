#!/usr/bin/env bun

import { spawnSync } from "node:child_process"
import { constants } from "node:fs"
import { access, cp, mkdir, readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { validateSkillContent } from "../packages/tools/src/lib/skill-frontmatter.ts"

function getRepoRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "unknown git error").trim()
    throw new Error(`Unable to resolve git repository root: ${details}`)
  }

  return result.stdout.trim()
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function syncSkills(repoRoot: string): Promise<number> {
  const sourceDir = path.join(repoRoot, ".claude", "skills")
  const targetDir = path.join(repoRoot, ".agents", "skills")

  if (!(await pathExists(sourceDir))) {
    console.warn(`[sync:skills] Source directory not found: ${path.relative(repoRoot, sourceDir)}`)
    return 0
  }

  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir)

  const errors: string[] = []

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry)
    const targetPath = path.join(targetDir, entry)

    // Validate SKILL.md frontmatter for directories
    const entryStat = await stat(sourcePath)
    if (entryStat.isDirectory()) {
      const skillMdPath = path.join(sourcePath, "SKILL.md")
      if (await pathExists(skillMdPath)) {
        const content = await readFile(skillMdPath, "utf8")
        const error = validateSkillContent(content)
        if (error) {
          errors.push(`  ${entry}/SKILL.md: ${error}`)
          continue
        }
      }
    }

    await cp(sourcePath, targetPath, {
      force: true,
      recursive: true,
    })
  }

  if (errors.length > 0) {
    const msg = `[sync:skills] ${errors.length} skill(s) have invalid SKILL.md files:\n${errors.join("\n")}`
    throw new Error(msg)
  }

  return entries.length
}

async function main(): Promise<void> {
  const repoRoot = getRepoRoot()
  const syncedEntries = await syncSkills(repoRoot)
  console.log(`[sync:skills] Synced ${syncedEntries} entries into .agents/skills`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[sync:skills] Failed: ${message}`)
  process.exit(1)
})
