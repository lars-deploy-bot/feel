#!/usr/bin/env bun
/**
 * Test script to verify superadmin access control
 *
 * Tests that:
 * 1. Lars (superadmin) CAN access claude-bridge workspace
 * 2. Barend (admin but NOT superadmin) CANNOT access claude-bridge workspace
 *
 * Run: bun scripts/test-superadmin-access.ts
 */

const DEV_SERVER = "http://localhost:8997"

// Test credentials - these users must exist in the database
const LARS_EMAIL = "eedenlars@gmail.com"
const BAREND_EMAIL = "barendbootsma@gmail.com"

interface LoginResponse {
  ok: boolean
  error?: string
  message?: string
}

interface StreamResponse {
  ok: boolean
  error?: string
  message?: string
}

async function login(email: string, password: string): Promise<string | null> {
  console.log(`\n🔐 Logging in as ${email}...`)

  const res = await fetch(`${DEV_SERVER}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  const data = (await res.json()) as LoginResponse

  if (!res.ok || !data.ok) {
    console.log(`   ❌ Login failed: ${data.error || data.message || res.status}`)
    return null
  }

  // Extract session cookie from response
  const setCookie = res.headers.get("set-cookie")
  if (!setCookie) {
    console.log(`   ❌ No session cookie in response`)
    return null
  }

  // Parse the session cookie value
  const match = setCookie.match(/bridge_session=([^;]+)/)
  if (!match) {
    console.log(`   ❌ Could not parse session cookie`)
    return null
  }

  console.log(`   ✅ Login successful`)
  return match[1]
}

async function testClaudeBridgeAccess(sessionCookie: string, userLabel: string): Promise<boolean> {
  console.log(`\n🧪 Testing claude-bridge access for ${userLabel}...`)

  const res = await fetch(`${DEV_SERVER}/api/claude/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `bridge_session=${sessionCookie}`,
    },
    body: JSON.stringify({
      message: "Hello, just testing access",
      workspace: "claude-bridge",
      conversationId: `test-${Date.now()}`,
    }),
  })

  // For streaming endpoint, 401 means blocked, 200 means allowed
  if (res.status === 401) {
    const data = (await res.json()) as StreamResponse
    console.log(`   🚫 Access DENIED (401): ${data.error || data.message}`)
    return false
  }

  if (res.status === 200) {
    // Don't consume the whole stream, just check we got access
    console.log(`   ✅ Access GRANTED (200)`)
    // Abort the stream since we just wanted to test access
    return true
  }

  const data = (await res.json().catch(() => ({}))) as StreamResponse
  console.log(`   ⚠️ Unexpected status ${res.status}: ${JSON.stringify(data)}`)
  return false
}

async function main() {
  console.log("=".repeat(60))
  console.log("🔒 SUPERADMIN ACCESS CONTROL TEST")
  console.log("=".repeat(60))
  console.log(`\nTarget: ${DEV_SERVER}`)
  console.log(`Superadmin workspace: claude-bridge`)

  // We need passwords to test - prompt or use env
  const larsPassword = process.env.LARS_PASSWORD
  const barendPassword = process.env.BAREND_PASSWORD

  if (!larsPassword || !barendPassword) {
    console.log("\n⚠️  Set LARS_PASSWORD and BAREND_PASSWORD environment variables")
    console.log("   Example: LARS_PASSWORD=xxx BAREND_PASSWORD=yyy bun scripts/test-superadmin-access.ts")
    process.exit(1)
  }

  // Test 1: Lars (should have access)
  console.log("\n" + "-".repeat(60))
  console.log("TEST 1: Lars (superadmin) - SHOULD have access")
  console.log("-".repeat(60))

  const larsSession = await login(LARS_EMAIL, larsPassword)
  if (!larsSession) {
    console.log("❌ Could not login as Lars - skipping test")
  } else {
    const larsAccess = await testClaudeBridgeAccess(larsSession, "Lars")
    if (larsAccess) {
      console.log("   ✅ PASS: Lars CAN access claude-bridge")
    } else {
      console.log("   ❌ FAIL: Lars should have access but was denied!")
    }
  }

  // Test 2: Barend (should NOT have access)
  console.log("\n" + "-".repeat(60))
  console.log("TEST 2: Barend (admin, NOT superadmin) - should NOT have access")
  console.log("-".repeat(60))

  const barendSession = await login(BAREND_EMAIL, barendPassword)
  if (!barendSession) {
    console.log("❌ Could not login as Barend - skipping test")
  } else {
    const barendAccess = await testClaudeBridgeAccess(barendSession, "Barend")
    if (!barendAccess) {
      console.log("   ✅ PASS: Barend correctly DENIED access to claude-bridge")
    } else {
      console.log("   ❌ FAIL: Barend should NOT have access but was granted!")
      console.log("   🚨 SECURITY ISSUE: Non-superadmin can access claude-bridge!")
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("TEST SUMMARY")
  console.log("=".repeat(60))

  if (larsSession && barendSession) {
    console.log("\n✅ Both tests completed - check results above")
  } else {
    console.log("\n⚠️  Some tests skipped due to login failures")
  }
}

main().catch(console.error)
