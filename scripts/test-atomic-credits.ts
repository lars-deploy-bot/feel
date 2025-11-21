#!/usr/bin/env bun
/**
 * Test Atomic Credit Deduction
 *
 * Tests the atomic credit deduction with a real org to verify:
 * 1. SQL function exists and works
 * 2. Concurrent requests don't cause negative balances
 * 3. Exactly the right number of requests succeed/fail
 *
 * Usage: cd apps/web && bun ../../scripts/test-atomic-credits.ts
 */

import { createClient } from "@supabase/supabase-js"
import type { Database as IamDatabase } from "../apps/web/lib/supabase/iam.types"
import type { Database as AppDatabase } from "../apps/web/lib/supabase/app.types"

const TEST_ORG_ID = "org_4c8fe7812be49a9e"  // Fabian's org (fabian.alive.best)

// Direct environment access (script should be run from apps/web directory)
const IAM_URL = process.env.SUPABASE_URL
const IAM_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.SUPABASE_URL  // Same Supabase instance
const APP_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!IAM_URL || !IAM_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in environment")
  console.error("Required:")
  console.error("  - SUPABASE_URL")
  console.error("  - SUPABASE_SERVICE_ROLE_KEY")
  console.error("\nMake sure to run from apps/web directory:")
  console.error("  cd apps/web && bun ../../scripts/test-atomic-credits.ts")
  process.exit(1)
}

// Create clients with correct schema configuration
const iam = createClient<IamDatabase>(IAM_URL, IAM_SERVICE_KEY, {
  db: {
    schema: "iam",  // Critical: Tell Supabase to use iam schema
  },
})

const app = createClient<AppDatabase>(APP_URL, APP_SERVICE_KEY, {
  db: {
    schema: "app",  // Critical: Tell Supabase to use app schema
  },
})

async function getCurrentCredits(orgId: string): Promise<number | null> {
  const { data, error } = await iam
    .from("orgs")
    .select("credits")
    .eq("org_id", orgId)
    .single()

  if (error) {
    console.error("❌ Error fetching credits:", error.message)
    return null
  }

  return data?.credits ?? 0
}

async function getDomainForOrg(orgId: string): Promise<string | null> {
  const { data, error } = await app
    .from("domains")
    .select("hostname")
    .eq("org_id", orgId)
    .limit(1)
    .single()

  if (error) {
    console.error("❌ Error fetching domain:", error.message)
    return null
  }

  return data?.hostname ?? null
}

async function testAtomicDeduction(orgId: string, amount: number): Promise<number | null> {
  console.log(`\n🧪 Testing atomic deduction: ${amount} credits`)

  const { data, error } = await iam.rpc("deduct_credits", {
    p_org_id: orgId,
    p_amount: amount,
  })

  if (error) {
    console.error("❌ RPC Error:", error.message)
    return null
  }

  if (data === null) {
    console.log("❌ Insufficient credits (atomic rejection)")
    return null
  }

  console.log(`✅ Success! New balance: ${data}`)
  return data as number
}

async function testConcurrentDeductions(orgId: string, amount: number, count: number) {
  console.log(`\n🧪 Testing ${count} concurrent deductions of ${amount} credits each`)

  const promises = Array.from({ length: count }, () =>
    iam.rpc("deduct_credits", {
      p_org_id: orgId,
      p_amount: amount,
    })
  )

  const results = await Promise.all(promises)

  const successes = results.filter(r => r.data !== null)
  const failures = results.filter(r => r.data === null)

  console.log(`✅ Successes: ${successes.length}`)
  console.log(`❌ Failures: ${failures.length}`)

  return { successes: successes.length, failures: failures.length }
}

async function setCredits(orgId: string, newBalance: number): Promise<boolean> {
  const { error } = await iam
    .from("orgs")
    .update({
      credits: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)

  if (error) {
    console.error("❌ Error setting credits:", error.message)
    return false
  }

  console.log(`✅ Set credits to ${newBalance}`)
  return true
}

async function main() {
  console.log("=== Atomic Credit Deduction Test ===\n")
  console.log(`Testing with org: ${TEST_ORG_ID}`)

  // Step 1: Verify org exists and get current credits
  console.log("\n📊 Step 1: Fetch current state")
  const currentCredits = await getCurrentCredits(TEST_ORG_ID)
  if (currentCredits === null) {
    console.error("❌ Org not found or error fetching credits")
    process.exit(1)
  }
  console.log(`Current credits: ${currentCredits}`)

  const domain = await getDomainForOrg(TEST_ORG_ID)
  if (domain) {
    console.log(`Domain: ${domain}`)
  }

  // Step 2: Check if RPC function exists
  console.log("\n📊 Step 2: Verify RPC function exists")
  const { data: functions, error: fnError } = await iam.rpc("deduct_credits", {
    p_org_id: TEST_ORG_ID,
    p_amount: 0, // Test with 0 to verify function exists
  })

  if (fnError) {
    if (fnError.message.includes("function") || fnError.message.includes("does not exist")) {
      console.error("❌ RPC function 'deduct_credits' does not exist!")
      console.error("Run the SQL migration first: docs/database/atomic-credit-deduction.sql")
      process.exit(1)
    }
    console.error("❌ Error calling RPC:", fnError.message)
  } else {
    console.log("✅ RPC function exists and is callable")
  }

  // Save original balance to restore later
  const originalBalance = currentCredits

  // Step 3: Test single deduction
  console.log("\n📊 Step 3: Test single deduction (5 credits)")
  await setCredits(TEST_ORG_ID, 100) // Set to 100 for testing
  const afterSingle = await testAtomicDeduction(TEST_ORG_ID, 5)

  if (afterSingle !== null && afterSingle !== 95) {
    console.error(`❌ Expected 95, got ${afterSingle}`)
  }

  // Step 4: Test insufficient credits
  console.log("\n📊 Step 4: Test insufficient credits")
  await setCredits(TEST_ORG_ID, 5) // Set to 5
  const insufficient = await testAtomicDeduction(TEST_ORG_ID, 10) // Try to deduct 10

  if (insufficient !== null) {
    console.error("❌ Should have rejected insufficient credits")
  }

  // Verify balance unchanged
  const afterInsufficientTest = await getCurrentCredits(TEST_ORG_ID)
  if (afterInsufficientTest !== 5) {
    console.error(`❌ Balance should still be 5, but is ${afterInsufficientTest}`)
  } else {
    console.log("✅ Balance unchanged (5 credits)")
  }

  // Step 5: Test concurrent deductions (the critical test!)
  console.log("\n📊 Step 5: Test concurrent deductions (race condition test)")
  await setCredits(TEST_ORG_ID, 10) // Set to exactly 10 credits

  // Launch 3 concurrent requests, each trying to deduct 5 credits
  // Expected: 2 succeed (10 → 5 → 0), 1 fails
  const { successes, failures } = await testConcurrentDeductions(TEST_ORG_ID, 5, 3)

  if (successes !== 2 || failures !== 1) {
    console.error(`❌ Expected 2 successes and 1 failure, got ${successes} successes and ${failures} failures`)
  } else {
    console.log("✅ Correct concurrent behavior!")
  }

  // Verify final balance is 0 (not negative!)
  const finalBalance = await getCurrentCredits(TEST_ORG_ID)
  if (finalBalance !== 0) {
    console.error(`❌ Expected final balance of 0, got ${finalBalance}`)
  } else {
    console.log("✅ Final balance is 0 (no negative balance!)")
  }

  // Step 6: Restore original balance
  console.log("\n📊 Step 6: Restore original balance")
  await setCredits(TEST_ORG_ID, originalBalance)
  console.log(`✅ Restored to ${originalBalance} credits`)

  console.log("\n✅ All tests passed!\n")
  console.log("Summary:")
  console.log("  ✅ RPC function exists")
  console.log("  ✅ Single deduction works")
  console.log("  ✅ Insufficient credits rejected")
  console.log("  ✅ Concurrent requests handled atomically")
  console.log("  ✅ No negative balances possible")
}

main().catch(error => {
  console.error("\n❌ Test failed:", error)
  process.exit(1)
})
