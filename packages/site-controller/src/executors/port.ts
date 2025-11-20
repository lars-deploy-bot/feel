import { runScript } from './common.js'
import type { PortAssignment } from '../types.js'

export interface AssignPortParams {
  domain: string
  registryPath: string
}

/**
 * Assign a port to a domain
 *
 * @param params - Port assignment parameters
 * @returns Port assignment result
 */
export async function assignPort(params: AssignPortParams): Promise<PortAssignment> {
  const stdout = await runScript('00-assign-port.sh', {
    SITE_DOMAIN: params.domain,
    REGISTRY_PATH: params.registryPath,
  })

  const port = parseInt(stdout.trim(), 10)

  if (isNaN(port)) {
    throw new Error(`Invalid port returned from script: ${stdout}`)
  }

  // Determine if this was a new assignment by checking stdout for "already has"
  const isNew = !stdout.includes('already has assigned port')

  return { port, isNew }
}
