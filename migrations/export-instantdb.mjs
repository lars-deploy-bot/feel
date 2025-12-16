#!/usr/bin/env node
/**
 * Export InstantDB data to JSON for import into Supabase
 */

import { init } from "@instantdb/admin"
import { writeFileSync } from "fs"

const INSTANT_APP_ID = "24474161-4251-40fb-a163-5f6105072154"
const INSTANT_ADMIN_TOKEN = "d641960a-d58f-4458-8e05-111fd694e21c"

const db = init({ appId: INSTANT_APP_ID, adminToken: INSTANT_ADMIN_TOKEN })

async function exportAll() {
  console.log("Exporting InstantDB data...")

  const entities = [
    "customers", "sessions", "insights", "experiments", "customerAttributes",
    "signals", "backlog_items", "issues", "docs", "blueprints",
    "blueprint_workflows", "blueprint_integrations", "blueprint_customers",
    "blueprint_issues", "blueprint_insights", "blueprint_signals",
    "positioning_blocks", "blueprint_user_flows"
  ]

  const data = {}

  for (const entity of entities) {
    try {
      const result = await db.query({ [entity]: {} })
      data[entity] = result[entity] || []
      console.log(`  ${entity}: ${data[entity].length} records`)
    } catch (err) {
      console.log(`  ${entity}: 0 records (not found)`)
      data[entity] = []
    }
  }

  writeFileSync("migrations/instantdb-export.json", JSON.stringify(data, null, 2))
  console.log("\nExported to migrations/instantdb-export.json")
}

exportAll()
