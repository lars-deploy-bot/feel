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
}
