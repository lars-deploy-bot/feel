import { domainsRepo } from "../../../db/repos"
import type { ManagerDomain } from "./domains.types"

export async function listDomains(orgId?: string): Promise<ManagerDomain[]> {
  const domains = orgId ? await domainsRepo.findByOrgId(orgId) : await domainsRepo.findAll()

  return domains.map(d => ({
    domain_id: d.domain_id,
    hostname: d.hostname,
    port: d.port,
    org_id: d.org_id,
    server_id: d.server_id,
    created_at: d.created_at,
  }))
}
