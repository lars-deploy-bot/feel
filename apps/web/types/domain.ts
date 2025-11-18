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
  credits: number
}

export interface DomainConfigClient {
  tenantId?: string
  port?: number
  orphaned?: boolean
  createdAt?: string
  email?: string
  orgId?: string
  credits: number
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
  dnsPointsToServer: boolean
  dnsResolvedIp: string | null
  dnsIsProxied?: boolean
  dnsVerificationMethod?: string
  vitePortMismatch: boolean
  viteExpectedPort: number
  viteActualPort: number | null
  hasSystemdPortOverride: boolean
  createdAt: string | null
  lastChecked: number
}

export interface ViteConfigInfo {
  domain: string
  expectedPort: number
  actualPort: number | null
  portMismatch: boolean
  configPath: string | null
  allowedHosts: string[] | null
  hasSystemdOverride: boolean
  systemdOverridePort: number | null
  error?: string
}

export type DomainPasswords = Record<string, DomainConfig>
