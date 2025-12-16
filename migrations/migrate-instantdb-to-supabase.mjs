#!/usr/bin/env node
/**
 * Migration script: InstantDB -> Supabase (self-hosted)
 * Uses direct PostgreSQL connection for reliable schema access
 *
 * Usage:
 *   node migrations/migrate-instantdb-to-supabase.mjs
 */

import { init } from "@instantdb/admin"
import pg from "pg"

const { Pool } = pg

// InstantDB config
const INSTANT_APP_ID = "24474161-4251-40fb-a163-5f6105072154"
const INSTANT_ADMIN_TOKEN = "d641960a-d58f-4458-8e05-111fd694e21c"

// PostgreSQL config (self-hosted Supabase)
const pool = new Pool({
  host: "localhost",
  port: 5433,
  database: "postgres",
  user: "postgres",
  password: "4SNjgvLR2aHMLBvASj+nbACcMhTLYqH6TvGg2Ntut5U",
})

// Initialize InstantDB
const instantDb = init({ appId: INSTANT_APP_ID, adminToken: INSTANT_ADMIN_TOKEN })

// ID mapping (InstantDB ID -> Supabase UUID)
const idMap = {
  customers: new Map(),
  sessions: new Map(),
  insights: new Map(),
  experiments: new Map(),
  signals: new Map(),
  backlog_items: new Map(),
  issues: new Map(),
  blueprints: new Map(),
}

/**
 * Convert ISO date string to timestamp or null
 */
function toTimestamp(dateStr) {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date.toISOString()
  } catch {
    return null
  }
}

/**
 * Map old ID to new Supabase UUID
 */
function mapId(table, oldId) {
  if (!oldId) return null
  return idMap[table]?.get(oldId) || null
}

/**
 * Insert a record and return the new ID
 */
async function insert(table, columns, values, oldId = null) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ")
  const query = `INSERT INTO crm.${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING id`

  try {
    const result = await pool.query(query, values)
    const newId = result.rows[0]?.id
    if (oldId && newId && idMap[table]) {
      idMap[table].set(oldId, newId)
    }
    return newId
  } catch (err) {
    console.error(`  ✗ Error inserting into ${table}: ${err.message}`)
    return null
  }
}

/**
 * Migrate customers
 */
async function migrateCustomers() {
  console.log("\n📦 Migrating customers...")
  const { customers } = await instantDb.query({ customers: {} })
  console.log(`  Found ${customers.length} customers`)

  for (const c of customers) {
    const columns = [
      "company", "contact", "contact_email", "type", "status",
      "site_url", "customer_goal", "next_steps", "next_step",
      "next_step_due", "owner", "last_touch_at", "created_at", "updated_at"
    ]
    const values = [
      c.company || "", c.contact || "", c.contactEmail || "",
      c.type || "freelancer", c.status || "lead",
      c.siteUrl || null, c.customerGoal || null, c.nextSteps || null, c.nextStep || null,
      toTimestamp(c.nextStepDue), c.owner || null, toTimestamp(c.lastTouchAt),
      toTimestamp(c.dateCreated) || new Date().toISOString(),
      toTimestamp(c.dateUpdated) || new Date().toISOString()
    ]

    const newId = await insert("customers", columns, values, c.id)
    if (newId) console.log(`  ✓ ${c.company}`)
  }
}

/**
 * Migrate sessions
 */
async function migrateSessions() {
  console.log("\n📦 Migrating sessions...")
  const { sessions } = await instantDb.query({ sessions: {} })
  console.log(`  Found ${sessions.length} sessions`)

  for (const s of sessions) {
    const customerId = mapId("customers", s.customerId)
    if (!customerId) {
      console.log(`  ⚠ Skipping session (no customer): ${s.title || "untitled"}`)
      continue
    }

    const columns = ["customer_id", "date", "type", "title", "notes", "created_by"]
    const values = [
      customerId,
      toTimestamp(s.date) || new Date().toISOString(),
      s.type || "discovery call",
      s.title || "",
      s.notes || null,
      s.createdBy || null
    ]

    const newId = await insert("sessions", columns, values, s.id)
    if (newId) console.log(`  ✓ ${s.title}`)
  }
}

/**
 * Migrate signals
 */
async function migrateSignals() {
  console.log("\n📦 Migrating signals...")
  const { signals } = await instantDb.query({ signals: {} })
  console.log(`  Found ${signals.length} signals`)

  for (const s of signals) {
    const customerId = mapId("customers", s.customerId)
    if (!customerId) {
      console.log(`  ⚠ Skipping signal (no customer): ${s.title || "untitled"}`)
      continue
    }

    const columns = [
      "customer_id", "kind", "title", "status", "area", "severity",
      "session_id", "verbatim", "context", "stage", "urgency_date",
      "owner", "outcome", "review_at", "linked_insight_ids", "created_at", "updated_at"
    ]
    const values = [
      customerId, s.kind || "request", s.title || "", s.status || "new",
      s.area || "other", s.severity || "medium",
      mapId("sessions", s.sessionId), s.verbatim || null, s.context || null,
      s.stage || null, toTimestamp(s.urgencyDate),
      s.owner || null, s.outcome || null, toTimestamp(s.reviewAt),
      JSON.stringify([]), // linked_insight_ids - will update later if needed
      toTimestamp(s.createdAt) || new Date().toISOString(),
      toTimestamp(s.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("signals", columns, values, s.id)
    if (newId) console.log(`  ✓ ${s.title}`)
  }
}

/**
 * Migrate insights
 */
async function migrateInsights() {
  console.log("\n📦 Migrating insights...")
  const { insights } = await instantDb.query({ insights: {} })
  console.log(`  Found ${insights.length} insights`)

  for (const i of insights) {
    const customerId = mapId("customers", i.customerId)
    if (!customerId) {
      console.log(`  ⚠ Skipping insight (no customer): ${i.text?.substring(0, 40)}...`)
      continue
    }

    const columns = [
      "customer_id", "session_id", "text", "kind", "topic", "confidence",
      "cluster", "job_situation", "job_motivation", "job_outcome",
      "insight_status", "source_signal_id", "created_at"
    ]
    const values = [
      customerId, mapId("sessions", i.sessionId),
      i.text || "", i.kind || "Insight", i.topic || "Other", i.confidence || "Medium",
      i.cluster || null, i.jobSituation || null, i.jobMotivation || null, i.jobOutcome || null,
      i.insightStatus || "draft", mapId("signals", i.sourceSignalId),
      toTimestamp(i.createdAt) || new Date().toISOString()
    ]

    const newId = await insert("insights", columns, values, i.id)
    if (newId) console.log(`  ✓ ${i.text?.substring(0, 40)}...`)
  }
}

/**
 * Migrate experiments
 */
async function migrateExperiments() {
  console.log("\n📦 Migrating experiments...")
  const { experiments } = await instantDb.query({ experiments: {} })
  console.log(`  Found ${experiments.length} experiments`)

  for (const e of experiments) {
    const columns = [
      "title", "type", "status", "area", "problem", "hypothesis",
      "change_description", "metric", "baseline", "target", "result",
      "decision", "insight_ids", "created_at", "updated_at"
    ]
    const values = [
      e.title || "", e.type || "Experiment", e.status || "Idea", e.area || "Other",
      e.problem || null, e.hypothesis || null, e.changeDescription || null,
      e.metric || null, e.baseline || null, e.target || null, e.result || null,
      e.decision || null,
      JSON.stringify((e.insightIds || []).map(id => mapId("insights", id)).filter(Boolean)),
      toTimestamp(e.createdAt) || new Date().toISOString(),
      toTimestamp(e.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("experiments", columns, values, e.id)
    if (newId) console.log(`  ✓ ${e.title}`)
  }
}

/**
 * Migrate customer attributes
 */
async function migrateCustomerAttributes() {
  console.log("\n📦 Migrating customer attributes...")
  const { customerAttributes } = await instantDb.query({ customerAttributes: {} })
  console.log(`  Found ${customerAttributes.length} attributes`)

  for (const a of customerAttributes) {
    const customerId = mapId("customers", a.customerId)
    if (!customerId) continue

    const columns = ["customer_id", "attribute_name", "attribute_value", "last_updated"]
    const values = [
      customerId, a.attributeName || "", a.attributeValue || null,
      toTimestamp(a.lastUpdated) || new Date().toISOString()
    ]

    const newId = await insert("customer_attributes", columns, values)
    if (newId) console.log(`  ✓ ${a.attributeName}`)
  }
}

/**
 * Migrate backlog items
 */
async function migrateBacklogItems() {
  console.log("\n📦 Migrating backlog items...")
  const { backlog_items } = await instantDb.query({ backlog_items: {} })
  console.log(`  Found ${backlog_items.length} items`)

  for (const b of backlog_items) {
    const columns = [
      "title", "description", "type", "status", "priority", "area", "owner",
      "customer_id", "signal_id", "insight_id", "experiment_id",
      "acceptance_criteria", "created_at", "updated_at"
    ]
    const values = [
      b.title || "", b.description || null, b.type || "feature",
      b.status || "inbox", b.priority || "p2", b.area || "other", b.owner || null,
      mapId("customers", b.customerId), mapId("signals", b.signalId),
      mapId("insights", b.insightId), mapId("experiments", b.experimentId),
      JSON.stringify(b.acceptanceCriteria || []),
      toTimestamp(b.createdAt) || new Date().toISOString(),
      toTimestamp(b.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("backlog_items", columns, values, b.id)
    if (newId) console.log(`  ✓ ${b.title}`)
  }
}

/**
 * Migrate issues
 */
async function migrateIssues() {
  console.log("\n📦 Migrating issues...")
  const { issues } = await instantDb.query({ issues: {} })
  console.log(`  Found ${issues.length} issues`)

  for (const i of issues) {
    const columns = [
      "key", "title", "description", "status", "priority", "rank",
      "assignee", "labels", "customer_id", "signal_id", "insight_id", "experiment_id",
      "solution", "based_on_signals", "what_we_wont_do", "how_we_know_it_works",
      "ready_for_dev", "needs_po", "created_at", "updated_at"
    ]
    const values = [
      i.key || null, i.title || "", i.description || null,
      i.status || "backlog", i.priority || "p2", i.rank || 0,
      i.assignee || null, JSON.stringify(i.labels || []),
      mapId("customers", i.customerId), mapId("signals", i.signalId),
      mapId("insights", i.insightId), mapId("experiments", i.experimentId),
      i.solution || null, i.basedOnSignals || null, i.whatWeWontDo || null, i.howWeKnowItWorks || null,
      i.readyForDev || false, i.needsPO || false,
      toTimestamp(i.createdAt) || new Date().toISOString(),
      toTimestamp(i.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("issues", columns, values, i.id)
    if (newId) console.log(`  ✓ ${i.key}: ${i.title}`)
  }
}

/**
 * Migrate docs
 */
async function migrateDocs() {
  console.log("\n📦 Migrating docs...")
  const { docs } = await instantDb.query({ docs: {} })
  console.log(`  Found ${docs.length} docs`)

  for (const d of docs) {
    const query = `INSERT INTO crm.docs (id, title, content, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`
    try {
      await pool.query(query, [
        d.id || crypto.randomUUID(),
        d.title || "",
        d.content || null,
        toTimestamp(d.updatedAt) || new Date().toISOString(),
        d.updatedBy || null
      ])
      console.log(`  ✓ ${d.title}`)
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
    }
  }
}

/**
 * Migrate blueprints
 */
async function migrateBlueprints() {
  console.log("\n📦 Migrating blueprints...")
  const { blueprints } = await instantDb.query({ blueprints: {} })
  console.log(`  Found ${blueprints.length} blueprints`)

  for (const b of blueprints) {
    const columns = [
      "name", "segment", "one_liner", "use_case", "status",
      "included_sections", "customization_variables", "proof_summary",
      "outcomes", "thumbnail_url", "demo_url", "internal_notes",
      "owner", "created_at", "updated_at"
    ]
    const values = [
      b.name || "", b.segment || "other", b.oneLiner || null, b.useCase || null,
      b.status || "draft",
      JSON.stringify(b.includedSections || []),
      JSON.stringify(b.customizationVariables || []),
      b.proofSummary || null,
      JSON.stringify(b.outcomes || []),
      b.thumbnailUrl || null, b.demoUrl || null, b.internalNotes || null,
      b.owner || null,
      toTimestamp(b.createdAt) || new Date().toISOString(),
      toTimestamp(b.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("blueprints", columns, values, b.id)
    if (newId) console.log(`  ✓ ${b.name}`)
  }
}

/**
 * Migrate blueprint workflows
 */
async function migrateBlueprintWorkflows() {
  console.log("\n📦 Migrating blueprint workflows...")
  const { blueprint_workflows } = await instantDb.query({ blueprint_workflows: {} })
  console.log(`  Found ${blueprint_workflows.length} workflows`)

  for (const w of blueprint_workflows) {
    const blueprintId = mapId("blueprints", w.blueprintId)
    if (!blueprintId) continue

    const columns = [
      "blueprint_id", "name", "description", "inputs", "outputs",
      "steps", "default_settings", "status", "created_at", "updated_at"
    ]
    const values = [
      blueprintId, w.name || "", w.description || null,
      JSON.stringify(w.inputs || []), JSON.stringify(w.outputs || []),
      JSON.stringify(w.steps || []), JSON.stringify(w.defaultSettings || {}),
      w.status || "draft",
      toTimestamp(w.createdAt) || new Date().toISOString(),
      toTimestamp(w.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("blueprint_workflows", columns, values)
    if (newId) console.log(`  ✓ ${w.name}`)
  }
}

/**
 * Migrate blueprint integrations
 */
async function migrateBlueprintIntegrations() {
  console.log("\n📦 Migrating blueprint integrations...")
  const { blueprint_integrations } = await instantDb.query({ blueprint_integrations: {} })
  console.log(`  Found ${blueprint_integrations.length} integrations`)

  for (const i of blueprint_integrations) {
    const blueprintId = mapId("blueprints", i.blueprintId)
    if (!blueprintId) continue

    const columns = ["blueprint_id", "tool", "purpose", "data_in", "data_out", "notes", "created_at"]
    const values = [
      blueprintId, i.tool || "other", i.purpose || null,
      JSON.stringify(i.dataIn || []), JSON.stringify(i.dataOut || []),
      i.notes || null, toTimestamp(i.createdAt) || new Date().toISOString()
    ]

    const newId = await insert("blueprint_integrations", columns, values)
    if (newId) console.log(`  ✓ ${i.tool}`)
  }
}

/**
 * Migrate blueprint-customer links
 */
async function migrateBlueprintCustomers() {
  console.log("\n📦 Migrating blueprint-customer links...")
  const { blueprint_customers } = await instantDb.query({ blueprint_customers: {} })
  console.log(`  Found ${blueprint_customers.length} links`)

  for (const l of blueprint_customers) {
    const blueprintId = mapId("blueprints", l.blueprintId)
    const customerId = mapId("customers", l.customerId)
    if (!blueprintId || !customerId) continue

    const columns = ["blueprint_id", "customer_id", "notes", "created_at"]
    const values = [blueprintId, customerId, l.notes || null, toTimestamp(l.createdAt) || new Date().toISOString()]

    await insert("blueprint_customers", columns, values)
    console.log(`  ✓ link`)
  }
}

/**
 * Migrate blueprint-issue links
 */
async function migrateBlueprintIssues() {
  console.log("\n📦 Migrating blueprint-issue links...")
  const { blueprint_issues } = await instantDb.query({ blueprint_issues: {} })
  console.log(`  Found ${blueprint_issues.length} links`)

  for (const l of blueprint_issues) {
    const blueprintId = mapId("blueprints", l.blueprintId)
    const issueId = mapId("issues", l.issueId)
    if (!blueprintId || !issueId) continue

    const columns = ["blueprint_id", "issue_id", "type", "created_at"]
    const values = [blueprintId, issueId, l.type || null, toTimestamp(l.createdAt) || new Date().toISOString()]

    await insert("blueprint_issues", columns, values)
    console.log(`  ✓ link`)
  }
}

/**
 * Migrate blueprint-insight links
 */
async function migrateBlueprintInsights() {
  console.log("\n📦 Migrating blueprint-insight links...")
  const { blueprint_insights } = await instantDb.query({ blueprint_insights: {} })
  console.log(`  Found ${blueprint_insights.length} links`)

  for (const l of blueprint_insights) {
    const blueprintId = mapId("blueprints", l.blueprintId)
    const insightId = mapId("insights", l.insightId)
    if (!blueprintId || !insightId) continue

    const columns = ["blueprint_id", "insight_id", "created_at"]
    const values = [blueprintId, insightId, toTimestamp(l.createdAt) || new Date().toISOString()]

    await insert("blueprint_insights", columns, values)
    console.log(`  ✓ link`)
  }
}

/**
 * Migrate blueprint-signal links
 */
async function migrateBlueprintSignals() {
  console.log("\n📦 Migrating blueprint-signal links...")
  const { blueprint_signals } = await instantDb.query({ blueprint_signals: {} })
  console.log(`  Found ${blueprint_signals.length} links`)

  for (const l of blueprint_signals) {
    const blueprintId = mapId("blueprints", l.blueprintId)
    const signalId = mapId("signals", l.signalId)
    if (!blueprintId || !signalId) continue

    const columns = ["blueprint_id", "signal_id", "created_at"]
    const values = [blueprintId, signalId, toTimestamp(l.createdAt) || new Date().toISOString()]

    await insert("blueprint_signals", columns, values)
    console.log(`  ✓ link`)
  }
}

/**
 * Migrate positioning blocks
 */
async function migratePositioningBlocks() {
  console.log("\n📦 Migrating positioning blocks...")
  const { positioning_blocks } = await instantDb.query({ positioning_blocks: {} })
  console.log(`  Found ${positioning_blocks.length} blocks`)

  for (const p of positioning_blocks) {
    const query = `INSERT INTO crm.positioning_blocks (id, title, kind, data, sort_order, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`
    try {
      await pool.query(query, [
        p.id || crypto.randomUUID(),
        p.title || "",
        p.kind || "paragraph",
        JSON.stringify(p.data || {}),
        p.order || 0,
        toTimestamp(p.updatedAt) || new Date().toISOString(),
        p.updatedBy || null
      ])
      console.log(`  ✓ ${p.title}`)
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
    }
  }
}

/**
 * Migrate blueprint user flows
 */
async function migrateBlueprintUserFlows() {
  console.log("\n📦 Migrating blueprint user flows...")
  const { blueprint_user_flows } = await instantDb.query({ blueprint_user_flows: {} })
  console.log(`  Found ${blueprint_user_flows.length} flows`)

  for (const f of blueprint_user_flows) {
    const blueprintId = mapId("blueprints", f.blueprintId)
    if (!blueprintId) continue

    const columns = [
      "blueprint_id", "name", "goal", "primary_actor", "secondary_actors",
      "trigger", "preconditions", "happy_path", "decisions", "states",
      "data_effects", "notifications", "edge_cases", "success_metrics",
      "telemetry", "out_of_scope", "owner", "status", "created_at", "updated_at"
    ]
    const values = [
      blueprintId, f.name || "", f.goal || null,
      f.primaryActor || "visitor", JSON.stringify(f.secondaryActors || []),
      f.trigger || null, JSON.stringify(f.preconditions || []),
      JSON.stringify(f.happyPath || []), JSON.stringify(f.decisions || []),
      JSON.stringify(f.states || []), JSON.stringify(f.dataEffects || []),
      JSON.stringify(f.notifications || []), JSON.stringify(f.edgeCases || []),
      JSON.stringify(f.successMetrics || []), JSON.stringify(f.telemetry || []),
      JSON.stringify(f.outOfScope || []), f.owner || null, f.status || "draft",
      toTimestamp(f.createdAt) || new Date().toISOString(),
      toTimestamp(f.updatedAt) || new Date().toISOString()
    ]

    const newId = await insert("blueprint_user_flows", columns, values)
    if (newId) console.log(`  ✓ ${f.name}`)
  }
}

/**
 * Main migration
 */
async function migrate() {
  console.log("🚀 Starting InstantDB → Supabase migration (direct PostgreSQL)")
  console.log("=" .repeat(60))

  try {
    // Test connection
    await pool.query("SELECT 1")
    console.log("✓ Connected to PostgreSQL")

    // Core entities (order matters for FK relationships)
    await migrateCustomers()
    await migrateSessions()
    await migrateSignals()
    await migrateInsights()
    await migrateExperiments()
    await migrateCustomerAttributes()
    await migrateBacklogItems()
    await migrateIssues()
    await migrateDocs()

    // Blueprints and related
    await migrateBlueprints()
    await migrateBlueprintWorkflows()
    await migrateBlueprintIntegrations()
    await migrateBlueprintCustomers()
    await migrateBlueprintIssues()
    await migrateBlueprintInsights()
    await migrateBlueprintSignals()
    await migratePositioningBlocks()
    await migrateBlueprintUserFlows()

    console.log("\n" + "=" .repeat(60))
    console.log("✅ Migration complete!")

    // Summary
    console.log("\n📊 Records migrated:")
    for (const [table, map] of Object.entries(idMap)) {
      console.log(`  ${table}: ${map.size}`)
    }

  } catch (error) {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
