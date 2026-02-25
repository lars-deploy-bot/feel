import { app } from "../clients"
import { InternalError } from "../../infra/errors"

export type DomainRow = {
  domain_id: string
  hostname: string
  port: number
  org_id: string | null
  server_id: string | null
  created_at: string
}

export async function findAll(): Promise<DomainRow[]> {
  const { data, error } = await app
    .from("domains")
    .select("domain_id, hostname, port, org_id, server_id, created_at")
    .eq("is_test_env", false)
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch domains: ${error.message}`)
  }
  return data ?? []
}

export async function findByOrgId(orgId: string): Promise<DomainRow[]> {
  const { data, error } = await app
    .from("domains")
    .select("domain_id, hostname, port, org_id, server_id, created_at")
    .eq("org_id", orgId)
    .eq("is_test_env", false)
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch domains for org ${orgId}: ${error.message}`)
  }
  return data ?? []
}
