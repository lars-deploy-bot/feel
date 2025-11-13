#!/usr/bin/env bun

import { writeFileSync } from "fs"
import { execSync } from "child_process"

const projectId = process.env.SUPABASE_PROJECT_ID

if (!projectId) {
  console.log("⚠️  SUPABASE_PROJECT_ID not set - skipping type generation")
  console.log("   Set SUPABASE_PROJECT_ID in .env to enable database type generation")
  process.exit(0)
}

const outFile = "lib/supabase/types.ts"

console.log(`📊 Generating Supabase types from project: ${projectId}`)

try {
  const output = execSync(`npx supabase gen types typescript --project-id ${projectId}`, {
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "pipe"],
  })

  writeFileSync(outFile, output)
  console.log(`✓ Types generated at ${outFile}`)
} catch (error) {
  console.error("❌ Failed to generate types:", (error as Error).message)
  console.log("   Using committed types as fallback")
  console.log("   To fix: npx supabase login")
  process.exit(0)
}
