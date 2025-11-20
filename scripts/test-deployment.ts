#!/usr/bin/env bun
/**
 * Internal deployment test script
 * Bypasses API authentication for quick testing
 */

import { deploySite } from "@alive-brug/deploy-scripts"

const testSlug = process.argv[2] || `test-${Date.now()}`
const domain = `${testSlug}.alive.best`

console.log(`🚀 Testing deployment: ${domain}`)
console.log(`📧 Email: test@bridge.internal`)
console.log("")

try {
  const result = await deploySite({
    domain,
    email: "test@bridge.internal",
    password: "test123", // Will create if doesn't exist
  })

  console.log("")
  console.log("✅ DEPLOYMENT SUCCESSFUL!")
  console.log("")
  console.log("📊 Result:")
  console.log(`   Domain: ${result.domain}`)
  console.log(`   Port: ${result.port}`)
  console.log(`   Service: ${result.serviceName}`)
  console.log(`   Directory: ${result.siteDirectory}`)
  console.log(`   Env File: ${result.envFile}`)
  console.log("")
  console.log("🔍 Verification Commands:")
  console.log(`   Check env file:  cat ${result.envFile}`)
  console.log(`   Check service:   systemctl status ${result.serviceName}`)
  console.log(`   Check port:      lsof -i :${result.port}`)
  console.log(`   Test site:       curl -I http://localhost:${result.port}`)
  console.log(`   View logs:       journalctl -u ${result.serviceName} -n 20`)
  console.log("")
  console.log(`🌐 Site URL: https://${domain}`)

  process.exit(0)
} catch (error) {
  console.error("")
  console.error("❌ DEPLOYMENT FAILED!")
  console.error("")
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    if (error.stack) {
      console.error("")
      console.error("Stack trace:")
      console.error(error.stack)
    }
  } else {
    console.error(String(error))
  }
  process.exit(1)
}
