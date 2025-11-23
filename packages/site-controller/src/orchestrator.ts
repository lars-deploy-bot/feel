import { assertServerOnly } from './guards.js'

// Prevent this module from being imported in browser environments
assertServerOnly('@webalive/site-controller', 'Use @webalive/shared for constants')

import type { DeployConfig, DeployResult } from './types.js'
import { PATHS, DEFAULTS, getServiceName, getSiteUser, getSiteHome, getEnvFilePath } from '@webalive/shared'
import { validateDns } from './executors/dns.js'
import { assignPort } from './executors/port.js'
import { ensureUser } from './executors/system.js'
import { setupFilesystem } from './executors/filesystem.js'
import { buildSite } from './executors/build.js'
import { startService } from './executors/service.js'
import { configureCaddy, teardown } from './executors/caddy.js'

/**
 * Site deployment orchestrator
 * Implements the Shell-Operator Pattern with sequential execution and rollback
 */
export class SiteOrchestrator {
  /**
   * Deploy a site with automatic rollback on failure
   *
   * @param config - Deployment configuration
   * @returns Deployment result
   */
  static async deploy(config: DeployConfig): Promise<DeployResult> {
    const {
      domain,
      slug,
      templatePath,
      rollbackOnFailure = true,
      serverIp = DEFAULTS.SERVER_IP,
      wildcardDomain = DEFAULTS.WILDCARD_DOMAIN,
    } = config

    // Validate domain format to prevent path traversal
    if (!/^[a-z0-9.-]+$/i.test(domain)) {
      throw new Error(`Invalid domain format: ${domain}`)
    }
    if (domain.includes('..') || domain.startsWith('/')) {
      throw new Error(`Path traversal detected in domain: ${domain}`)
    }

    const serviceName = getServiceName(slug)
    let deployedPort: number | undefined

    console.log(`\n=== Starting deployment for ${domain} ===\n`)

    try {
      // Phase 1: DNS Validation
      console.log('[Phase 1/7] Validating DNS...')
      const dnsResult = await validateDns({ domain, serverIp, wildcardDomain })
      if (!dnsResult.valid) {
        throw new Error(`DNS validation failed: ${dnsResult.message}`)
      }
      console.log('✓ DNS validation passed\n')

      // Phase 2: Port Assignment
      console.log('[Phase 2/7] Assigning port...')
      const portResult = await assignPort({
        domain,
        registryPath: PATHS.REGISTRY_PATH,
      })
      deployedPort = portResult.port
      console.log(`✓ Port assigned: ${deployedPort}${portResult.isNew ? ' (new)' : ' (existing)'}\n`)

      // Phase 3: User Creation
      console.log('[Phase 3/7] Ensuring system user...')
      const siteUser = getSiteUser(slug)
      const siteHome = getSiteHome(domain)
      await ensureUser({ user: siteUser, home: siteHome })
      console.log(`✓ User ready: ${siteUser}\n`)

      // Phase 4: Filesystem Setup
      console.log('[Phase 4/7] Setting up filesystem...')
      await setupFilesystem({
        user: siteUser,
        domain,
        targetDir: siteHome,
        templatePath,
        legacySitesRoot: PATHS.LEGACY_SITES_ROOT,
      })
      console.log(`✓ Filesystem ready: ${siteHome}\n`)

      // Phase 5: Build Site
      console.log('[Phase 5/7] Building site...')
      await buildSite({
        user: siteUser,
        domain,
        port: deployedPort,
        slug,
        targetDir: siteHome,
        envFilePath: getEnvFilePath(slug),
      })
      console.log('✓ Site built successfully\n')

      // Phase 6: Start Service
      console.log('[Phase 6/7] Starting systemd service...')
      await startService({
        slug,
        port: deployedPort,
        domain,
        serviceName,
      })
      console.log(`✓ Service started: ${serviceName}\n`)

      // Phase 7: Configure Caddy
      console.log('[Phase 7/7] Configuring Caddy...')
      await configureCaddy({
        domain,
        port: deployedPort,
        caddyfilePath: PATHS.CADDYFILE_PATH,
        caddyLockPath: PATHS.CADDY_LOCK,
        flockTimeout: DEFAULTS.FLOCK_TIMEOUT,
      })
      console.log('✓ Caddy configured\n')

      console.log(`\n=== Deployment successful: ${domain} ===`)
      console.log(`Site URL: https://${domain}`)
      console.log(`Port: ${deployedPort}`)
      console.log(`Service: ${serviceName}\n`)

      return {
        domain,
        port: deployedPort,
        serviceName,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`\n✗ Deployment failed: ${errorMessage}\n`)

      // Determine which phase failed
      let failedPhase = 'unknown'
      if (errorMessage.includes('DNS')) failedPhase = 'dns'
      else if (errorMessage.includes('port')) failedPhase = 'port'
      else if (errorMessage.includes('user')) failedPhase = 'user'
      else if (errorMessage.includes('filesystem')) failedPhase = 'filesystem'
      else if (errorMessage.includes('build')) failedPhase = 'build'
      else if (errorMessage.includes('service')) failedPhase = 'service'
      else if (errorMessage.includes('Caddy')) failedPhase = 'caddy'

      // Attempt rollback if enabled
      if (rollbackOnFailure && deployedPort) {
        console.log('\n=== Attempting rollback ===\n')
        try {
          await this.teardown(domain, {
            removeFiles: false,
            removeUser: false,
            removePort: false,  // Keep port reserved for retry
          })
          console.log('✓ Rollback successful\n')
        } catch (rollbackError) {
          console.error(
            `✗ Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}\n`
          )
        }
      }

      return {
        domain,
        port: deployedPort || 0,
        serviceName,
        success: false,
        error: errorMessage,
        failedPhase,
      }
    }
  }

  /**
   * Teardown a deployed site
   *
   * @param domain - Domain to teardown
   * @param options - Teardown options
   */
  static async teardown(
    domain: string,
    options: {
      removeUser?: boolean
      removeFiles?: boolean
      removePort?: boolean
    } = {}
  ): Promise<void> {
    const slug = domain.replace(/\./g, '-')
    const serviceName = getServiceName(slug)

    console.log(`\n=== Tearing down ${domain} ===\n`)

    await teardown({
      domain,
      slug,
      serviceName,
      removeUser: options.removeUser,
      removeFiles: options.removeFiles,
      removePort: options.removePort,
      caddyfilePath: PATHS.CADDYFILE_PATH,
      caddyLockPath: PATHS.CADDY_LOCK,
      envFilePath: getEnvFilePath(slug),
      registryPath: PATHS.REGISTRY_PATH,
    })

    console.log(`\n=== Teardown complete: ${domain} ===\n`)
  }
}
