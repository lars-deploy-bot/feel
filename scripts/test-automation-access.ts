/**
 * Test script to verify automation can access a workspace
 * Run: bun scripts/test-automation-access.ts zomaar.test.local
 */

import { statSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { PATHS } from "@webalive/shared"

const workspace = process.argv[2] || "zomaar.test.local"
const basePath = `${PATHS.SITES_ROOT}/${workspace}`
const userPath = join(basePath, "user")

console.log(`Testing automation access for: ${workspace}\n`)

// Test 1: Base path exists
try {
  const baseStat = statSync(basePath)
  console.log(`✓ Base path exists: ${basePath}`)
  console.log(`  UID: ${baseStat.uid}, GID: ${baseStat.gid}`)
} catch (e) {
  console.log(`✗ Base path error: ${(e as Error).message}`)
  process.exit(1)
}

// Test 2: User path exists
try {
  const userStat = statSync(userPath)
  console.log(`✓ User path exists: ${userPath}`)
  console.log(`  UID: ${userStat.uid}, GID: ${userStat.gid}`)
} catch (e) {
  console.log(`✗ User path error: ${(e as Error).message}`)
  process.exit(1)
}

// Test 3: Can list user directory
try {
  const files = readdirSync(userPath)
  console.log(`✓ Can list user directory: ${files.length} items`)
} catch (e) {
  console.log(`✗ Cannot list user directory: ${(e as Error).message}`)
}

// Test 4: Can access src directory (the failing path)
const srcPath = join(userPath, "src")
try {
  const srcStat = statSync(srcPath)
  console.log(`✓ Src path exists: ${srcPath}`)
  console.log(`  Mode: ${srcStat.mode.toString(8)}`)

  const srcFiles = readdirSync(srcPath)
  console.log(`✓ Can list src directory: ${srcFiles.length} items`)

  // Check subdirectories
  for (const file of srcFiles) {
    const filePath = join(srcPath, file)
    try {
      const fileStat = statSync(filePath)
      const isDir = fileStat.isDirectory()
      const mode = fileStat.mode.toString(8)
      const canRead = (fileStat.mode & 0o004) !== 0
      console.log(`  ${isDir ? "📁" : "📄"} ${file} (${mode}) ${canRead ? "" : "⚠️ no world-read"}`)

      if (isDir) {
        try {
          readdirSync(filePath)
        } catch (e) {
          console.log(`     ⚠️ Cannot read contents: ${(e as Error).message}`)
        }
      }
    } catch (e) {
      console.log(`  ✗ ${file}: ${(e as Error).message}`)
    }
  }
} catch (e) {
  console.log(`✗ Src path error: ${(e as Error).message}`)
}

console.log("\nTest complete.")
