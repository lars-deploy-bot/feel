/**
 * Shared domain configuration types
 * Used by both client and server for type safety
 */

export interface DomainConfig {
  tenantId?: string
  passwordHash: string
  port: number
  createdAt?: string
  email?: string
  tokens: number
}

export interface DomainConfigClient {
  tenantId?: string
  port?: number
  orphaned?: boolean
  createdAt?: string
  email?: string
  tokens?: number
  credits?: number
}

export interface DomainStatus {
  domain: string
  portListening: boolean
  httpAccessible: boolean
  httpsAccessible: boolean
  systemdServiceExists: boolean
  systemdServiceRunning: boolean
  caddyConfigured: boolean
  siteDirectoryExists: boolean
  createdAt: string | null
  lastChecked: number
}

export type DomainPasswords = Record<string, DomainConfig>
