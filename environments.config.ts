/**
 * Claude Bridge Environments Configuration
 *
 * ⚠️  SINGLE SOURCE OF TRUTH: environments.json
 *
 * This file reads from environments.json which is the canonical configuration.
 * All environment-specific values (ports, domains, process names, etc.) are defined in that JSON file.
 * Update environments.json to change environment configuration.
 *
 * Usage:
 *   - TypeScript: import { environments, Environment } from './environments.config'
 *   - Direct access: environments.dev.port, environments.production.processName
 */

import * as fs from 'fs'
import * as path from 'path'

export type EnvironmentKey = 'production' | 'staging' | 'dev'

export interface Environment {
  // Identification
  key: EnvironmentKey
  displayName: string
  prefix: string

  // Network
  port: number
  domain: string
  cdnDomain?: string
  subdomain?: string

  // Processes
  processName: string
  serverScript: string

  // Workspace
  workspacePath: string

  // Flags
  isProduction: boolean
  hasHotReload: boolean

  // Commands
  deployCommand: string
  logsCommand: string
  restartCommand: string
}

// Load from environments.json (single source of truth)
const envPath = path.join(__dirname, 'environments.json')
const rawConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
export const environments: Record<EnvironmentKey, Environment> = rawConfig.environments

/**
 * Get environment by key
 */
export function getEnvironment(key: EnvironmentKey): Environment {
  const env = environments[key]
  if (!env) {
    throw new Error(`Unknown environment: ${key}`)
  }
  return env
}

/**
 * Get all environments as array
 */
export function getAllEnvironments(): Environment[] {
  return Object.values(environments)
}

/**
 * Get environment by port
 */
export function getEnvironmentByPort(port: number): Environment | undefined {
  return getAllEnvironments().find(e => e.port === port)
}

/**
 * Get environment by process name
 */
export function getEnvironmentByProcessName(name: string): Environment | undefined {
  return getAllEnvironments().find(e => e.processName === name)
}

/**
 * Get environment by domain
 */
export function getEnvironmentByDomain(domain: string): Environment | undefined {
  return getAllEnvironments().find(e => e.domain === domain || e.cdnDomain === domain)
}

/**
 * Validation
 */
function validateEnvironments() {
  const allEnvs = getAllEnvironments()

  // Check for duplicate ports
  const ports = allEnvs.map(e => e.port)
  if (new Set(ports).size !== ports.length) {
    throw new Error('Duplicate ports in environment configuration')
  }

  // Check for duplicate process names
  const processNames = allEnvs.map(e => e.processName)
  if (new Set(processNames).size !== processNames.length) {
    throw new Error('Duplicate process names in environment configuration')
  }

  // Check for valid ports
  if (allEnvs.some(e => e.port < 1024 || e.port > 65535)) {
    throw new Error('Invalid port range (must be 1024-65535)')
  }

  // Check exactly one production
  const prodCount = allEnvs.filter(e => e.isProduction).length
  if (prodCount !== 1) {
    throw new Error(`Must have exactly 1 production environment, found ${prodCount}`)
  }
}

validateEnvironments()

export default environments
