#!/usr/bin/env bun
/**
 * Automation Scheduler - Run Due Jobs
 *
 * This script is called by cron to check for and run due automation jobs.
 * It polls the database for jobs where next_run_at <= now and triggers them.
 *
 * This runs on the production server via cron every 5 minutes.
 * It always targets the production API (terminal.goalive.nl).
 *
 * Usage: bun run scripts/automation/run-due-jobs.ts
 * Cron entry: Every 5 minutes via run-due-jobs.sh
 */

import { createClient } from "@supabase/supabase-js"

// Lock file to prevent concurrent runs
const LOCK_FILE = "/tmp/automation-scheduler.lock"
const fs = await import("node:fs")

// Check for existing lock
if (fs.existsSync(LOCK_FILE)) {
  const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs
  const LOCK_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

  if (lockAge < LOCK_TIMEOUT_MS) {
    console.log(`[Automation Scheduler] Already running (lock age: ${Math.round(lockAge / 1000)}s)`)
    process.exit(0)
  } else {
    console.log(`[Automation Scheduler] Stale lock detected, removing (age: ${Math.round(lockAge / 1000)}s)`)
    fs.unlinkSync(LOCK_FILE)
  }
}

// Create lock file
fs.writeFileSync(LOCK_FILE, String(process.pid))

// Cleanup on exit
process.on("exit", () => {
  try {
    fs.unlinkSync(LOCK_FILE)
  } catch {
    // Ignore
  }
})

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

// Get Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[Automation Scheduler] Missing Supabase credentials")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "app" } })

console.log(`[Automation Scheduler] Starting at ${new Date().toISOString()}`)

// Get due jobs using the database function
const { data: dueJobs, error } = await supabase.rpc("get_due_automation_jobs")

if (error) {
  console.error("[Automation Scheduler] Error fetching due jobs:", error)
  process.exit(1)
}

if (!dueJobs || dueJobs.length === 0) {
  console.log("[Automation Scheduler] No due jobs found")
  process.exit(0)
}

console.log(`[Automation Scheduler] Found ${dueJobs.length} due job(s)`)

// Get the internal API secret for triggering jobs
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error("[Automation Scheduler] Missing JWT_SECRET for internal API calls")
  process.exit(1)
}

// Base URL for internal API calls (production)
const API_BASE_URL = process.env.API_BASE_URL || "https://terminal.goalive.nl"

// Trigger each due job
for (const job of dueJobs) {
  console.log(`[Automation Scheduler] Triggering job: ${job.name} (${job.id})`)

  try {
    const response = await fetch(`${API_BASE_URL}/api/internal/automation/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": JWT_SECRET,
      },
      body: JSON.stringify({ jobId: job.id }),
    })

    const result = await response.json()

    if (response.ok && result.ok) {
      console.log(`[Automation Scheduler] Job ${job.id} completed: ${result.durationMs}ms`)
    } else {
      console.error(`[Automation Scheduler] Job ${job.id} failed:`, result.error || response.statusText)
    }
  } catch (error) {
    console.error(`[Automation Scheduler] Error triggering job ${job.id}:`, error)
  }
}

console.log(`[Automation Scheduler] Finished at ${new Date().toISOString()}`)
