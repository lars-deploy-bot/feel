/**
 * Playwright Global Setup - Bootstrap Worker Tenants
 *
 * Creates isolated tenant for each worker before tests run.
 */

import type { FullConfig } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"

/**
 * Poll for tenant readiness with exponential backoff
 * Replaces arbitrary 2-second delay with explicit ready checks
 */
async function verifyTenantReadiness(baseUrl: string, workers: number): Promise<void> {
  const maxAttempts = 20 // 20 attempts at 200ms = 4s max
  const delayMs = 200

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const results = await Promise.all(
      Array.from({ length: workers }).map(async (_, idx) => {
        const email = `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${idx}@${TEST_CONFIG.EMAIL_DOMAIN}`
        try {
          const res = await fetch(`${baseUrl}/api/test/verify-tenant?email=${encodeURIComponent(email)}`)
          const data = await res.json()
          return data.ready === true
        } catch {
          return false
        }
      }),
    )

    const allReady = results.every(Boolean)
    if (allReady) {
      console.log(`   ✓ All tenants ready (verified in ${attempt * delayMs}ms)`)
      return
    }

    // Log progress every 5 attempts
    if (attempt % 5 === 0) {
      const readyCount = results.filter(Boolean).length
      console.log(`   ⏱ Attempt ${attempt}/${maxAttempts}: ${readyCount}/${workers} tenants ready`)
    }

    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  throw new Error(`Tenant verification timeout after ${maxAttempts * delayMs}ms. Database consistency issue detected.`)
}

export default async function globalSetup(config: FullConfig) {
  const runId = `E2E_${new Date().toISOString()}`
  process.env.E2E_RUN_ID = runId

  const workers = config.workers ?? 4
  const baseUrl = config.projects[0]?.use?.baseURL || TEST_CONFIG.BASE_URL

  console.log(`\n🚀 [Global Setup] Bootstrapping ${workers} worker tenants`)
  console.log(`📝 [Global Setup] Run ID: ${runId}\n`)

  try {
    await Promise.all(
      Array.from({ length: workers }).map(async (_, i) => {
        const email = `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${i}@${TEST_CONFIG.EMAIL_DOMAIN}`
        const workspace = `${TEST_CONFIG.WORKSPACE_PREFIX}${i}.${TEST_CONFIG.EMAIL_DOMAIN}`

        const res = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            workerIndex: i,
            email,
            workspace,
            credits: TEST_CONFIG.DEFAULT_CREDITS,
          }),
        })

        const data = await res.json()

        if (!data.ok) {
          throw new Error(`Worker ${i} bootstrap failed: ${data.error}`)
        }

        console.log(`✓ Worker ${i}: ${email}`)
      }),
    )

    console.log("\n✅ [Global Setup] All tenants created\n")

    // Poll for tenant readiness instead of fixed delay
    console.log("⏳ Verifying tenant readiness...")
    await verifyTenantReadiness(baseUrl, workers)
    console.log("✅ All tenants verified\n")
  } catch (error) {
    console.error("\n❌ [Global Setup] Failed:", error)
    throw error
  }
}
