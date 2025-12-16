#!/usr/bin/env node
/**
 * Generate SQL import file and execute via docker exec
 */

import { readFileSync, writeFileSync } from "fs"
import { execSync } from "child_process"

const data = JSON.parse(readFileSync("migrations/instantdb-export.json", "utf-8"))

function escape(val, forceJsonb = false) {
  if (val === null || val === undefined) return "NULL"
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE"
  if (typeof val === "number") return String(val)
  if (Array.isArray(val)) {
    // Check if array contains objects - if so, use JSONB
    if (val.length > 0 && typeof val[0] === "object") {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
    }
    if (val.length === 0) return forceJsonb ? "'[]'::jsonb" : "'{}'::text[]"
    const escaped = val.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")
    return `'{${escaped}}'`
  }
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
  }
  return `'${String(val).replace(/'/g, "''")}'`
}

function toTimestamp(dateStr) {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date.toISOString()
  } catch {
    return null
  }
}

// Generate SQL
let sql = `-- CRM Data Import from InstantDB
-- Generated: ${new Date().toISOString()}

-- Clear existing data first
TRUNCATE crm.blueprint_user_flows, crm.blueprint_signals, crm.blueprint_insights, crm.blueprint_issues, crm.blueprint_customers, crm.blueprint_integrations, crm.blueprint_workflows, crm.blueprints, crm.positioning_blocks, crm.docs, crm.issues, crm.backlog_items, crm.customer_attributes, crm.experiments, crm.insights, crm.signals, crm.sessions, crm.customers CASCADE;

-- Reset sequences
ALTER SEQUENCE crm.issue_key_seq RESTART WITH 1;

`

// Generate customer inserts with deterministic IDs based on company name
const customerIds = new Map()
for (let i = 0; i < (data.customers || []).length; i++) {
  const c = data.customers[i]
  // Create deterministic UUID-like ID
  const id = `00000000-0000-0000-0001-${String(i + 1).padStart(12, "0")}`
  customerIds.set(c.id, id)

  sql += `INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '${id}', ${escape(c.company)}, ${escape(c.contact)}, ${escape(c.contactEmail)},
  ${escape(c.type || "freelancer")}, ${escape(c.status || "lead")},
  ${escape(c.siteUrl)}, ${escape(c.customerGoal)}, ${escape(c.nextSteps)}, ${escape(c.nextStep)},
  ${escape(toTimestamp(c.nextStepDue))}, ${escape(c.owner)}, ${escape(toTimestamp(c.lastTouchAt))},
  ${escape(toTimestamp(c.dateCreated) || new Date().toISOString())},
  ${escape(toTimestamp(c.dateUpdated) || new Date().toISOString())}
);\n`
}

// Generate session inserts
const sessionIds = new Map()
for (let i = 0; i < (data.sessions || []).length; i++) {
  const s = data.sessions[i]
  const customerId = customerIds.get(s.customerId)
  if (!customerId) continue

  const id = `00000000-0000-0000-0002-${String(i + 1).padStart(12, "0")}`
  sessionIds.set(s.id, id)

  sql += `INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '${id}', '${customerId}',
  ${escape(toTimestamp(s.date) || new Date().toISOString())},
  ${escape(s.type || "discovery call")}, ${escape(s.title || "Untitled Session")}, ${escape(s.notes)}, ${escape(s.createdBy)}
);\n`
}

// Generate signal inserts
const signalIds = new Map()
for (let i = 0; i < (data.signals || []).length; i++) {
  const s = data.signals[i]
  const customerId = customerIds.get(s.customerId)
  if (!customerId) continue

  const id = `00000000-0000-0000-0003-${String(i + 1).padStart(12, "0")}`
  signalIds.set(s.id, id)

  sql += `INSERT INTO crm.signals (id, customer_id, kind, title, status, area, severity, session_id, verbatim, context, stage, urgency_date, owner, outcome, review_at, linked_insight_ids, created_at, updated_at) VALUES (
  '${id}', '${customerId}',
  ${escape(s.kind || "request")}, ${escape(s.title)}, ${escape(s.status || "new")},
  ${escape(s.area || "other")}, ${escape(s.severity || "medium")},
  ${sessionIds.get(s.sessionId) ? `'${sessionIds.get(s.sessionId)}'` : "NULL"},
  ${escape(s.verbatim)}, ${escape(s.context)}, ${escape(s.stage)}, ${escape(toTimestamp(s.urgencyDate))},
  ${escape(s.owner)}, ${escape(s.outcome)}, ${escape(toTimestamp(s.reviewAt))},
  '{}'::uuid[], ${escape(toTimestamp(s.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(s.updatedAt) || new Date().toISOString())}
);\n`
}

// Generate insight inserts
const insightIds = new Map()
for (let i = 0; i < (data.insights || []).length; i++) {
  const ins = data.insights[i]
  const customerId = customerIds.get(ins.customerId)
  if (!customerId) continue

  const id = `00000000-0000-0000-0004-${String(i + 1).padStart(12, "0")}`
  insightIds.set(ins.id, id)

  sql += `INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '${id}', '${customerId}',
  ${sessionIds.get(ins.sessionId) ? `'${sessionIds.get(ins.sessionId)}'` : "NULL"},
  ${escape(ins.text)}, ${escape(ins.kind || "Insight")}, ${escape(ins.topic || "Other")},
  ${escape(ins.confidence || "Medium")}, ${escape(ins.cluster)}, ${escape(ins.jobSituation)},
  ${escape(ins.jobMotivation)}, ${escape(ins.jobOutcome)}, ${escape(ins.insightStatus || "draft")},
  ${signalIds.get(ins.sourceSignalId) ? `'${signalIds.get(ins.sourceSignalId)}'` : "NULL"},
  ${escape(toTimestamp(ins.createdAt) || new Date().toISOString())}
);\n`
}

// Generate experiment inserts
const experimentIds = new Map()
for (let i = 0; i < (data.experiments || []).length; i++) {
  const e = data.experiments[i]
  const id = `00000000-0000-0000-0005-${String(i + 1).padStart(12, "0")}`
  experimentIds.set(e.id, id)

  const insIds = (e.insightIds || []).map(iid => insightIds.get(iid)).filter(Boolean)

  sql += `INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '${id}', ${escape(e.title)}, ${escape(e.type || "Experiment")}, ${escape(e.status || "Idea")},
  ${escape(e.area || "Other")}, ${escape(e.problem)}, ${escape(e.hypothesis)},
  ${escape(e.changeDescription)}, ${escape(e.metric)}, ${escape(e.baseline)},
  ${escape(e.target)}, ${escape(e.result)}, ${escape(e.decision)},
  '{${insIds.map(id => `"${id}"`).join(",")}}'::uuid[],
  ${escape(toTimestamp(e.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(e.updatedAt) || new Date().toISOString())}
);\n`
}

// Generate customer attributes
for (const a of data.customerAttributes || []) {
  const customerId = customerIds.get(a.customerId)
  if (!customerId) continue

  sql += `INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '${customerId}', ${escape(a.attributeName)}, ${escape(a.attributeValue)},
  ${escape(toTimestamp(a.lastUpdated) || new Date().toISOString())}
);\n`
}

// Generate issues
const issueIds = new Map()
for (let i = 0; i < (data.issues || []).length; i++) {
  const iss = data.issues[i]
  const id = `00000000-0000-0000-0006-${String(i + 1).padStart(12, "0")}`
  issueIds.set(iss.id, id)

  sql += `INSERT INTO crm.issues (id, key, title, description, status, priority, rank, assignee, labels, customer_id, signal_id, insight_id, experiment_id, solution, based_on_signals, what_we_wont_do, how_we_know_it_works, ready_for_dev, needs_po, created_at, updated_at) VALUES (
  '${id}', ${escape(iss.key)}, ${escape(iss.title)}, ${escape(iss.description)},
  ${escape(iss.status || "backlog")}, ${escape(iss.priority || "p2")}, ${iss.rank || 0},
  ${escape(iss.assignee)}, ${escape(iss.labels || [])},
  ${customerIds.get(iss.customerId) ? `'${customerIds.get(iss.customerId)}'` : "NULL"},
  ${signalIds.get(iss.signalId) ? `'${signalIds.get(iss.signalId)}'` : "NULL"},
  ${insightIds.get(iss.insightId) ? `'${insightIds.get(iss.insightId)}'` : "NULL"},
  ${experimentIds.get(iss.experimentId) ? `'${experimentIds.get(iss.experimentId)}'` : "NULL"},
  ${escape(iss.solution)}, ${escape(iss.basedOnSignals)}, ${escape(iss.whatWeWontDo)},
  ${escape(iss.howWeKnowItWorks)}, ${iss.readyForDev || false}, ${iss.needsPO || false},
  ${escape(toTimestamp(iss.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(iss.updatedAt) || new Date().toISOString())}
);\n`
}

// Generate blueprints
const blueprintIds = new Map()
for (let i = 0; i < (data.blueprints || []).length; i++) {
  const b = data.blueprints[i]
  const id = `00000000-0000-0000-0007-${String(i + 1).padStart(12, "0")}`
  blueprintIds.set(b.id, id)

  sql += `INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '${id}', ${escape(b.name)}, ${escape(b.segment || "other")}, ${escape(b.oneLiner)},
  ${escape(b.useCase)}, ${escape(b.status || "draft")},
  ${escape(b.includedSections || [])}, ${escape(b.customizationVariables || [])},
  ${escape(b.proofSummary)}, ${escape(b.outcomes || [])}::jsonb,
  ${escape(b.thumbnailUrl)}, ${escape(b.demoUrl)}, ${escape(b.internalNotes)}, ${escape(b.owner)},
  ${escape(toTimestamp(b.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(b.updatedAt) || new Date().toISOString())}
);\n`
}

// Generate blueprint workflows
for (const w of data.blueprint_workflows || []) {
  const blueprintId = blueprintIds.get(w.blueprintId)
  if (!blueprintId) continue

  sql += `INSERT INTO crm.blueprint_workflows (blueprint_id, name, description, inputs, outputs, steps, default_settings, status, created_at, updated_at) VALUES (
  '${blueprintId}', ${escape(w.name)}, ${escape(w.description)},
  ${escape(w.inputs || [])}, ${escape(w.outputs || [])}, ${escape(w.steps || [])},
  ${escape(w.defaultSettings || {})}::jsonb, ${escape(w.status || "draft")},
  ${escape(toTimestamp(w.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(w.updatedAt) || new Date().toISOString())}
);\n`
}

// Generate blueprint integrations
for (const i of data.blueprint_integrations || []) {
  const blueprintId = blueprintIds.get(i.blueprintId)
  if (!blueprintId) continue

  sql += `INSERT INTO crm.blueprint_integrations (blueprint_id, tool, purpose, data_in, data_out, notes, created_at) VALUES (
  '${blueprintId}', ${escape(i.tool || "other")}, ${escape(i.purpose)},
  ${escape(i.dataIn || [])}, ${escape(i.dataOut || [])}, ${escape(i.notes)},
  ${escape(toTimestamp(i.createdAt) || new Date().toISOString())}
);\n`
}

// Generate blueprint user flows
for (const f of data.blueprint_user_flows || []) {
  const blueprintId = blueprintIds.get(f.blueprintId)
  if (!blueprintId) continue

  sql += `INSERT INTO crm.blueprint_user_flows (blueprint_id, name, goal, primary_actor, secondary_actors, trigger, preconditions, happy_path, decisions, states, data_effects, notifications, edge_cases, success_metrics, telemetry, out_of_scope, owner, status, created_at, updated_at) VALUES (
  '${blueprintId}', ${escape(f.name)}, ${escape(f.goal)},
  ${escape(f.primaryActor || "visitor")}, ${escape(f.secondaryActors || [])},
  ${escape(f.trigger)}, ${escape(f.preconditions || [])},
  ${escape(f.happyPath || [])}::jsonb, ${escape(f.decisions || [])}::jsonb,
  ${escape(f.states || [])}::jsonb, ${escape(f.dataEffects || [])},
  ${escape(f.notifications || [])}, ${escape(f.edgeCases || [])}::jsonb,
  ${escape(f.successMetrics || [])}, ${escape(f.telemetry || [])}, ${escape(f.outOfScope || [])},
  ${escape(f.owner)}, ${escape(f.status || "draft")},
  ${escape(toTimestamp(f.createdAt) || new Date().toISOString())},
  ${escape(toTimestamp(f.updatedAt) || new Date().toISOString())}
);\n`
}

// Write SQL file
writeFileSync("migrations/import-data.sql", sql)
console.log("Generated migrations/import-data.sql")

// Execute via docker
console.log("\nExecuting SQL...")
try {
  execSync("docker exec -i supabase-db psql -U postgres -d postgres < migrations/import-data.sql", {
    stdio: "inherit"
  })
  console.log("\n✅ Import complete!")
} catch (err) {
  console.error("Import failed:", err.message)
}

// Verify
console.log("\n📊 Verifying import...")
const counts = execSync(
  `docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT 'customers', COUNT(*) FROM crm.customers UNION ALL SELECT 'sessions', COUNT(*) FROM crm.sessions UNION ALL SELECT 'insights', COUNT(*) FROM crm.insights UNION ALL SELECT 'experiments', COUNT(*) FROM crm.experiments UNION ALL SELECT 'blueprints', COUNT(*) FROM crm.blueprints"`,
  { encoding: "utf-8" }
)
console.log(counts)
