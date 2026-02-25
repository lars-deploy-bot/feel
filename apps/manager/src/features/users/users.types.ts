export interface UserOrg {
  org_id: string
  name: string
  role: string
}

export interface UserSession {
  domain_hostname: string
  session_count: number
  last_activity: string
}

export interface User {
  user_id: string
  email: string | null
  display_name: string | null
  status: string
  created_at: string
  updated_at: string
  orgs: UserOrg[]
  org_count: number
  last_active: string | null
  sessions: UserSession[]
  session_count: number
}

export interface UserEvent {
  id: string
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}
