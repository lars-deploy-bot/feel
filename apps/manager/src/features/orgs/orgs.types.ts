export interface OrgMember {
  user_id: string
  email: string
  display_name: string | null
  role: string
  created_at: string | null
}

export interface OrgDomain {
  domain_id: string
  hostname: string
  port: number | null
  org_id: string | null
  created_at: string
}

export interface Organization {
  org_id: string
  name: string
  credits: number
  created_at: string
  updated_at: string | null
  members: OrgMember[]
  member_count: number
  domains: OrgDomain[]
  domain_count: number
}
