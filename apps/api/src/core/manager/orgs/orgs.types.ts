export interface ManagerOrgMember {
  user_id: string
  email: string
  display_name: string | null
  role: string
  created_at: string | null
}

export interface ManagerOrgDomain {
  domain_id: string
  hostname: string
  port: number
  org_id: string | null
  server_id: string | null
  created_at: string
}

export interface ManagerOrganization {
  org_id: string
  name: string
  credits: number
  created_at: string | null
  updated_at: string | null
  members: ManagerOrgMember[]
  member_count: number
  domains: ManagerOrgDomain[]
  domain_count: number
}
