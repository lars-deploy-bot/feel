import { deploySite as deploySiteLib, DeploymentError } from "@alive-brug/deploy-scripts"

export interface DeploySiteOptions {
  domain: string
  email: string // REQUIRED: User's email (for account linking and org resolution)
  password?: string // Optional: For new account creation (if user doesn't exist)
  orgId?: string // Optional: Organization ID (for logging/validation, script will resolve independently)
}

export interface DeploySiteResult {
  port: number
  domain: string
  serviceName: string
}

export async function deploySite(options: DeploySiteOptions): Promise<DeploySiteResult> {
  const domain = options.domain.toLowerCase() // Always lowercase domain

  console.log(`[Deploy] Deploying: ${domain}`)
  console.log(`[Deploy] Email: ${options.email || "(none - will create new account)"}`)
  console.log(`[Deploy] Password: ${options.password ? "(provided)" : "(not provided - using existing account)"}`)

  try {
    const result = await deploySiteLib({
      domain,
      email: options.email,
      password: options.password,
      orgId: options.orgId,
    })

    console.log("[Deploy] ✅ Site deployed successfully")
    console.log(`[Deploy] Domain: ${result.domain}`)
    console.log(`[Deploy] Port: ${result.port}`)
    console.log(`[Deploy] Service: ${result.serviceName}`)

    return {
      port: result.port,
      domain: result.domain,
      serviceName: result.serviceName,
    }
  } catch (error) {
    if (error instanceof DeploymentError) {
      console.error(`[Deploy] Deployment error: ${error.message}`)
      throw new Error(error.message)
    }

    if (error instanceof Error) {
      console.error(`[Deploy] Error: ${error.message}`)
      throw error
    }

    throw new Error(`Deployment failed: ${String(error)}`)
  }
}
