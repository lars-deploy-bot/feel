import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import type { ExecutionMode } from "@webalive/database"
import { DEFAULTS, PATHS, PORTS } from "@webalive/shared"
import { checkDomainInCaddy, configureCaddy, regeneratePortMap, SiteOrchestrator } from "@webalive/site-controller"
import { normalizeAndValidateDomain } from "@/features/manager/lib/domain-utils"
import { resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getNewSiteExecutionMode } from "@/lib/sandbox/e2b-workspace"
import { getSiteWorkspaceRoot, siteWorkspaceExists } from "@/lib/site-workspace-registry"
import { deploySite } from "./deploy-site"
import { DomainRegistrationError, isDomainRegistered, registerDomain, unregisterDomain } from "./domain-registry"
import { createInitialSiteSandbox, prepareE2bSiteDeployment } from "./e2b-site-deployment"

// ---------------------------------------------------------------------------
// Per-domain deployment lock (process-local).
// Prevents two concurrent deploys for the same domain within the same process
// from racing past the siteExistedBefore check and having the loser's rollback
// destroy the winner. Cross-process races are guarded by Supabase's unique
// constraint on the domains table during registerDomain().
// ---------------------------------------------------------------------------
const activeDeployments = new Map<string, true>()

function acquireDeployLock(domain: string): void {
  if (activeDeployments.has(domain)) {
    throw new DomainRegistrationError(
      ErrorCodes.DEPLOYMENT_IN_PROGRESS,
      `A deployment for "${domain}" is already in progress`,
      { domain },
    )
  }
  activeDeployments.set(domain, true)
}

function releaseDeployLock(domain: string): void {
  activeDeployments.delete(domain)
}

export interface StrictDeploymentInput {
  domain: string
  email: string
  password?: string
  orgId?: string
  templatePath: string
  skipBuild?: boolean
}

export interface StrictDeploymentResult {
  domain: string
  port: number
  serviceName: string
  executionMode: ExecutionMode
}

function validateInput(input: StrictDeploymentInput): {
  domain: string
  email: string
  password?: string
  orgId?: string
  templatePath: string
} {
  const normalized = normalizeAndValidateDomain(input.domain)
  if (!normalized.isValid) {
    throw new DomainRegistrationError(ErrorCodes.INVALID_DOMAIN, normalized.error || "Invalid domain", {
      domain: input.domain,
    })
  }

  const email = input.email.trim()
  if (!email) {
    throw new DomainRegistrationError(ErrorCodes.VALIDATION_ERROR, "Email is required", {
      field: "email",
    })
  }

  const templatePath = input.templatePath.trim()
  if (!templatePath) {
    throw new DomainRegistrationError(ErrorCodes.VALIDATION_ERROR, "Template path is required", {
      field: "templatePath",
    })
  }

  if (input.orgId !== undefined && input.orgId.trim().length === 0) {
    throw new DomainRegistrationError(ErrorCodes.VALIDATION_ERROR, "Organization ID cannot be empty", {
      field: "orgId",
    })
  }

  return {
    domain: normalized.domain,
    email,
    password: input.password,
    orgId: input.orgId,
    templatePath,
  }
}

function validatePort(domain: string, port: number): number {
  if (!Number.isInteger(port)) {
    throw new DomainRegistrationError(ErrorCodes.DEPLOYMENT_FAILED, "Deployment returned a non-integer port", {
      domain,
      port,
    })
  }

  if (port < PORTS.SITE_RANGE.MIN || port > PORTS.SITE_RANGE.MAX) {
    throw new DomainRegistrationError(
      ErrorCodes.DEPLOYMENT_FAILED,
      `Deployment returned an out-of-range port (${PORTS.SITE_RANGE.MIN}-${PORTS.SITE_RANGE.MAX})`,
      {
        domain,
        port,
      },
    )
  }

  return port
}

function getRoutingVerificationPath(): string | null {
  const serverConfigPath = process.env.SERVER_CONFIG_PATH
  const generatorMode = !!serverConfigPath && existsSync(serverConfigPath)

  if (generatorMode && PATHS.CADDYFILE_SITES && existsSync(PATHS.CADDYFILE_SITES)) {
    return PATHS.CADDYFILE_SITES
  }

  if (PATHS.CADDYFILE_PATH && existsSync(PATHS.CADDYFILE_PATH)) {
    return PATHS.CADDYFILE_PATH
  }

  return null
}

async function verifyRouting(domain: string): Promise<void> {
  const verificationPath = getRoutingVerificationPath()
  if (!verificationPath) {
    return
  }

  const hasRoute = await checkDomainInCaddy(domain, verificationPath)
  if (!hasRoute) {
    throw new DomainRegistrationError(ErrorCodes.DEPLOYMENT_FAILED, "Caddy routing verification failed after reload", {
      domain,
      caddyfile: verificationPath,
    })
  }
}

async function rollbackAfterPipelineFailure(params: {
  domain: string
  siteExistedBefore: boolean
  domainExistedBefore: boolean
  executionMode: ExecutionMode
}): Promise<void> {
  const rollbackErrors: string[] = []

  // If this domain did not exist in DB before this run, remove any record we may have created.
  if (!params.domainExistedBefore) {
    try {
      const nowRegistered = await isDomainRegistered(params.domain)
      if (nowRegistered) {
        await unregisterDomain(params.domain)
      }
    } catch (error) {
      rollbackErrors.push(`db-unregister: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (params.executionMode === "e2b") {
    if (!params.siteExistedBefore) {
      try {
        await rm(getSiteWorkspaceRoot(params.domain, "e2b"), { recursive: true, force: true })
      } catch (error) {
        rollbackErrors.push(`scratch-cleanup: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else if (!params.siteExistedBefore) {
    // Only teardown infrastructure if it didn't exist before this attempt.
    try {
      await SiteOrchestrator.teardown(params.domain, {
        removeFiles: true,
        removeUser: true,
      })
    } catch (error) {
      rollbackErrors.push(`infra-teardown: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (rollbackErrors.length > 0) {
    console.error(`[Deploy Pipeline] Rollback incomplete for ${params.domain}: ${rollbackErrors.join(" | ")}`)
  }
}

function getSiteExistsForMode(domain: string, executionMode: ExecutionMode): boolean {
  return executionMode === "systemd"
    ? existsSync(getSiteWorkspaceRoot(domain, executionMode))
    : siteWorkspaceExists(domain)
}

/**
 * Single strict deployment pipeline for API routes:
 * deploy infrastructure -> register domain -> regenerate/reload Caddy -> verify routing.
 *
 * Per-domain lock prevents concurrent deploys from racing past the existence
 * checks and having the loser's rollback destroy the winner's infrastructure.
 */
export async function runStrictDeployment(input: StrictDeploymentInput): Promise<StrictDeploymentResult> {
  const validated = validateInput(input)

  acquireDeployLock(validated.domain)
  try {
    return await runStrictDeploymentLocked(validated, input.skipBuild)
  } finally {
    releaseDeployLock(validated.domain)
  }
}

async function runStrictDeploymentLocked(
  validated: ReturnType<typeof validateInput>,
  skipBuild?: boolean,
): Promise<StrictDeploymentResult> {
  const executionMode = getNewSiteExecutionMode()
  const siteExistedBefore = getSiteExistsForMode(validated.domain, executionMode)
  const domainExistedBefore = await isDomainRegistered(validated.domain)

  // E2B sites use transient sandboxes with their own routing (preview-proxy resolves
  // them via domain registry, not port-map.json). They intentionally skip Caddy config
  // and port-map regeneration — those are only for systemd-managed persistent sites.
  if (executionMode === "e2b") {
    try {
      const deployResult = await prepareE2bSiteDeployment({
        domain: validated.domain,
        templatePath: validated.templatePath,
      })

      const port = validatePort(validated.domain, deployResult.port)

      await registerDomain({
        hostname: validated.domain,
        email: validated.email,
        password: validated.password,
        port,
        executionMode: "e2b",
        orgId: validated.orgId,
      })

      const domainRuntime = await resolveDomainRuntime(validated.domain)
      if (!domainRuntime) {
        throw new DomainRegistrationError(
          ErrorCodes.DEPLOYMENT_FAILED,
          "Domain registration succeeded but runtime lookup failed",
          {
            domain: validated.domain,
          },
        )
      }

      await createInitialSiteSandbox(domainRuntime, deployResult.scratchWorkspace)

      return {
        domain: validated.domain,
        port,
        serviceName: deployResult.serviceName,
        executionMode: "e2b",
      }
    } catch (error) {
      await rollbackAfterPipelineFailure({
        domain: validated.domain,
        siteExistedBefore,
        domainExistedBefore,
        executionMode,
      })
      throw error
    }
  }

  const deployResult = await deploySite({
    domain: validated.domain,
    email: validated.email,
    password: validated.password,
    orgId: validated.orgId,
    templatePath: validated.templatePath,
    skipBuild,
  })

  try {
    const port = validatePort(validated.domain, deployResult.port)

    await registerDomain({
      hostname: validated.domain,
      email: validated.email,
      password: validated.password,
      port,
      orgId: validated.orgId,
    })

    // Regenerate port-map.json and verify the domain is routable by preview-proxy.
    // Awaited: a deployment without a working preview is not a deployment.
    await regeneratePortMap(validated.domain)

    await configureCaddy({
      domain: validated.domain,
      port,
      caddyfilePath: PATHS.CADDYFILE_PATH,
      caddyLockPath: PATHS.CADDY_LOCK,
      flockTimeout: DEFAULTS.FLOCK_TIMEOUT,
    })

    await verifyRouting(validated.domain)

    return {
      domain: validated.domain,
      port,
      serviceName: deployResult.serviceName,
      executionMode: "systemd",
    }
  } catch (error) {
    await rollbackAfterPipelineFailure({
      domain: validated.domain,
      siteExistedBefore,
      domainExistedBefore,
      executionMode,
    })
    throw error
  }
}
