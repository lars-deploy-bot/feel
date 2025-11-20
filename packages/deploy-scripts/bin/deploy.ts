#!/usr/bin/env bun

/**
 * sitectl deployment CLI
 *
 * Usage:
 *   export DEPLOY_EMAIL="user@example.com"
 *   bun bin/deploy.ts domain.com
 */

import { deploySite, DeploymentError } from "../src/orchestration"

async function main() {
  if (process.argv.length < 3) {
    console.error(`Usage: bun ${process.argv[1]} domain.com`)
    console.error("\nEnvironment variables:")
    console.error("  DEPLOY_EMAIL (required) - User's email")
    console.error("  DEPLOY_PASSWORD (optional) - Password for new account")
    console.error("  DEPLOY_ORG_ID (optional) - Organization ID")
    process.exit(2)
  }

  const domain = process.argv[2].toLowerCase()
  const email = process.env.DEPLOY_EMAIL || ""
  const password = process.env.DEPLOY_PASSWORD
  const orgId = process.env.DEPLOY_ORG_ID

  if (!email) {
    console.error("❌ DEPLOY_EMAIL environment variable is required")
    process.exit(1)
  }

  try {
    console.log(`🚀 Deploying ${domain}...`)

    const result = await deploySite({
      domain,
      email,
      password,
      orgId,
    })

    console.log("")
    console.log(`🎉 Deployment complete!`)
    console.log(`📊 Domain: ${result.domain}`)
    console.log(`📊 Port: ${result.port}`)
    console.log(`📊 Service: ${result.serviceName}`)
    console.log(`📊 Site: ${result.siteDirectory}`)
    console.log("")
    console.log(`🌐 Your site: https://${result.domain}`)
  } catch (error) {
    if (error instanceof DeploymentError) {
      console.error(`❌ ${error.message}`)
    } else if (error instanceof Error) {
      console.error(`❌ ${error.message}`)
    } else {
      console.error(`❌ ${String(error)}`)
    }
    process.exit(1)
  }
}

main()
