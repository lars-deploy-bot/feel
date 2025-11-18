#!/usr/bin/env bun
/**
 * Standalone Database Cleanup Script
 *
 * This script cleans up all test data from the database.
 * Can be run manually or scheduled via cron.
 *
 * Usage:
 *   bun scripts/cleanup-test-database.ts           # Dry run (preview only)
 *   bun scripts/cleanup-test-database.ts --force   # Actually delete
 *
 * Add to cron (runs daily at 2am):
 *   0 2 * * * cd /root/webalive/claude-bridge && bun scripts/cleanup-test-database.ts --force >> /var/log/test-cleanup.log 2>&1
 */

import { cleanupTestDatabase } from "../apps/web/lib/test-helpers/cleanup-test-database"

async function main() {
  const args = process.argv.slice(2)
  const forceDelete = args.includes("--force")
  const dryRun = !forceDelete

  console.log("🧹 Database Test Cleanup Script")
  console.log("================================")
  console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "FORCE DELETE (will actually delete)"}`)
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log("")

  if (dryRun) {
    console.log("ℹ️  This is a DRY RUN. No data will be deleted.")
    console.log("ℹ️  To actually delete, run: bun scripts/cleanup-test-database.ts --force")
    console.log("")
  }

  try {
    const stats = await cleanupTestDatabase(dryRun)

    console.log("")
    console.log(`✅ ${dryRun ? "Preview completed" : "Cleanup completed"} successfully!`)
    console.log("================================")
    console.log("Summary:")
    console.log(`  • Users ${dryRun ? "to delete" : "deleted"}: ${stats.usersDeleted}`)
    console.log(`  • Organizations ${dryRun ? "to delete" : "deleted"}: ${stats.orgsDeleted}`)
    console.log(`  • Domains ${dryRun ? "to delete" : "deleted"}: ${stats.domainsDeleted}`)
    console.log(`  • Memberships ${dryRun ? "to delete" : "deleted"}: ${stats.membershipsDeleted}`)
    console.log(`  • Invites ${dryRun ? "to delete" : "deleted"}: ${stats.invitesDeleted}`)
    console.log(`  • Sessions ${dryRun ? "to delete" : "deleted"}: ${stats.sessionsDeleted}`)
    console.log("")
    if (dryRun) {
      console.log("ℹ️  No data was deleted. This was a preview only.")
      console.log("ℹ️  To actually delete, run: bun scripts/cleanup-test-database.ts --force")
      console.log("")
    }
    console.log(`Finished at: ${new Date().toISOString()}`)

    process.exit(0)
  } catch (error) {
    console.error("")
    console.error("❌ Cleanup failed!")
    console.error("================================")
    console.error(error)
    console.error("")
    console.error(`Failed at: ${new Date().toISOString()}`)

    process.exit(1)
  }
}

main()
