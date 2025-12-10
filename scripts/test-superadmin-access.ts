#!/usr/bin/env bun
/**
 * Test script to verify superadmin access control
 *
 * Tests that:
 * 1. Lars (superadmin) CAN access claude-bridge workspace
 * 2. Unauthenticated requests are blocked
 * 3. (Manual) Non-superadmin users are blocked by verifyWorkspaceAccess()
 *
 * Run: bun scripts/test-superadmin-access.ts
 */

import { randomUUID } from "node:crypto"

const DEV_SERVER = "http://localhost:8997"

// Lars - the only superadmin
const LARS_EMAIL = "eedenlars@gmail.com"
const LARS_PASSWORD = "supersecret"

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

  // Parse the session cookie value (auth_session_v2 is the current cookie name)
  const match = setCookie.match(/auth_session_v2=([^;]+)/)
  if (!match) {
    console.log(`   ❌ Could not parse session cookie from: ${setCookie.substring(0, 100)}...`)
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
      Cookie: `auth_session_v2=${sessionCookie}`,
    },
    body: JSON.stringify({
      message: "Hello, just testing access",
      workspace: "claude-bridge",
      conversationId: randomUUID(),
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

async function testUnauthenticatedAccess(): Promise<boolean> {
  console.log(`\n🧪 Testing unauthenticated access to claude-bridge...`)

  const res = await fetch(`${DEV_SERVER}/api/claude/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `auth_session_v2=fake-invalid-token`,
    },
    body: JSON.stringify({
      message: "Hello, just testing access",
      workspace: "claude-bridge",
      conversationId: randomUUID(),
    }),
  })

  // Should be blocked
  if (res.status === 200) {
    console.log(`   ❌ Access GRANTED - SECURITY ISSUE!`)
    return false
  }

  const data = (await res.json().catch(() => ({}))) as StreamResponse
  console.log(`   🚫 Access DENIED (${res.status}): ${data.error || data.message || "unknown"}`)
  return true
}

async function main() {
  console.log("=".repeat(60))
  console.log("🔒 SUPERADMIN ACCESS CONTROL TEST")
  console.log("=".repeat(60))
  console.log(`\nTarget: ${DEV_SERVER}`)
  console.log(`Superadmin workspace: claude-bridge`)

  let larsResult = false
  let unauthResult = false

  // Test 1: Lars (should have access)
  console.log("\n" + "-".repeat(60))
  console.log("TEST 1: Lars (superadmin) - SHOULD have access")
  console.log("-".repeat(60))

  const larsSession = await login(LARS_EMAIL, LARS_PASSWORD)
  if (!larsSession) {
    console.log("❌ Could not login as Lars - skipping test")
  } else {
    const larsAccess = await testClaudeBridgeAccess(larsSession, "Lars (superadmin)")
    if (larsAccess) {
      console.log("   ✅ PASS: Lars CAN access claude-bridge")
      larsResult = true
    } else {
      console.log("   ❌ FAIL: Lars should have access but was denied!")
    }
  }

  // Test 2: Unauthenticated (should NOT have access)
  console.log("\n" + "-".repeat(60))
  console.log("TEST 2: Unauthenticated request - should NOT have access")
  console.log("-".repeat(60))

  unauthResult = await testUnauthenticatedAccess()
  if (unauthResult) {
    console.log("   ✅ PASS: Unauthenticated correctly DENIED")
  } else {
    console.log("   ❌ FAIL: Unauthenticated should NOT have access!")
    console.log("   🚨 SECURITY ISSUE!")
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("TEST SUMMARY")
  console.log("=".repeat(60))
  console.log(`\n  Lars (superadmin) access:   ${larsResult ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`  Unauthenticated blocked:    ${unauthResult ? "✅ PASS" : "❌ FAIL"}`)

  if (larsResult && unauthResult) {
    console.log("\n🎉 ALL TESTS PASSED - Superadmin access control is working correctly!")
    console.log("\n📋 Note: The security enforcement for non-superadmin users with")
    console.log("   claude-bridge in their JWT is handled in verifyWorkspaceAccess()")
    console.log("   (features/auth/lib/auth.ts:257-267)")
  } else {
    console.log("\n⚠️  SOME TESTS FAILED - Check output above")
    process.exit(1)
  }
}

main().catch(console.error)
