/**
 * Manager API response types — shared contract between apps/api and apps/manager.
 *
 * SINGLE SOURCE OF TRUTH. Both the API (producer) and Manager UI (consumer) import from here.
 */
import type { ClaudeModel } from "./models"

export interface ManagerUserOrg {
  org_id: string
  name: string
  role: string
}

export interface ManagerUserSession {
  domain_hostname: string
  session_count: number
  last_activity: string
}

export interface ManagerUser {
  user_id: string
  email: string | null
  display_name: string | null
  status: string
  created_at: string
  updated_at: string
  orgs: ManagerUserOrg[]
  org_count: number
  last_active: string | null
  sessions: ManagerUserSession[]
  session_count: number
  enabled_models: ClaudeModel[]
}

export interface ManagerUserEvent {
  id: string
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}

export interface ManagerPasswordResetToken {
  token: string
  expires_at: string
}

export interface ManagerUserDevice {
  browser: string | null
  browser_version: string | null
  os: string | null
  os_version: string | null
  device_type: string | null
  screen: string | null
  last_seen: string
}

export interface ManagerUserLocation {
  city: string | null
  country: string | null
  region: string | null
  timezone: string | null
  last_seen: string
}

export interface ManagerUserProfile {
  devices: ManagerUserDevice[]
  locations: ManagerUserLocation[]
  referrer: string | null
  initial_referrer: string | null
}
