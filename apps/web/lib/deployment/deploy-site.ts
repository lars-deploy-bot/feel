import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export interface DeploySiteOptions {
  domain: string
  email: string // REQUIRED: User's email (for account linking and org resolution)
  password?: string // Optional: For new account creation (if user doesn't exist)
  orgId?: string // Optional: Organization ID (for logging/validation, script will resolve independently)
}

export interface DeploySiteResult {
  stdout: string
  stderr: string
}

export async function deploySite(options: DeploySiteOptions): Promise<DeploySiteResult> {
  const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh"
  const domain = options.domain.toLowerCase() // Always lowercase domain
  const deployCommand = `bash ${scriptPath} ${domain}`

  console.log(`[Deploy] Executing: ${deployCommand}`)
  console.log(`[Deploy] Email: ${options.email || "(none - will create new account)"}`)
  console.log(`[Deploy] Password: ${options.password ? "(provided)" : "(not provided - using existing account)"}`)

  const { stdout, stderr } = await execAsync(deployCommand, {
    timeout: 300000,
    cwd: "/root/webalive/claude-bridge",
    env: {
      ...process.env,
      DEPLOY_PASSWORD: options.password || "",
      DEPLOY_EMAIL: options.email || "",
    },
  })

  if (stdout) {
    console.log(`[Deploy] STDOUT:\n${stdout}`)
  }
  if (stderr) {
    console.warn(`[Deploy] STDERR:\n${stderr}`)
  }

  return { stdout, stderr }
}
