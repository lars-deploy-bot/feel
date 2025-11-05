import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export interface DeploySiteOptions {
  domain: string
  password: string
}

export interface DeploySiteResult {
  stdout: string
  stderr: string
}

export async function deploySite(options: DeploySiteOptions): Promise<DeploySiteResult> {
  const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh"
  const deployCommand = `bash ${scriptPath} ${options.domain}`

  console.log(`[Deploy] Executing: ${deployCommand}`)

  const { stdout, stderr } = await execAsync(deployCommand, {
    timeout: 300000,
    cwd: "/root/webalive/claude-bridge",
    env: {
      ...process.env,
      DEPLOY_PASSWORD: options.password,
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
