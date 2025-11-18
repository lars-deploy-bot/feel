import { createAppClient } from "@/lib/supabase/app"

export interface DomainConfig {
  domain_id: string
  hostname: string
  org_id: string | null
  port: number
  created_at: string
}

export async function getAllDomains(): Promise<Map<string, DomainConfig>> {
  const app = await createAppClient("service")
  const { data, error } = await app.from("domains").select("*")

  if (error) {
    console.error("[Domains] Failed to fetch domains:", error)
    return new Map()
  }

  const domainMap = new Map<string, DomainConfig>()
  for (const domain of data || []) {
    domainMap.set(domain.hostname, domain)
  }

  return domainMap
}

export async function getDomain(hostname: string): Promise<DomainConfig | null> {
  const app = await createAppClient("service")
  const { data, error } = await app.from("domains").select("*").eq("hostname", hostname).single()

  if (error || !data) {
    console.error(`[Domains] Domain not found: ${hostname}`, error)
    return null
  }

  return data
}

export async function getDomainPort(hostname: string): Promise<number | null> {
  const domain = await getDomain(hostname)
  return domain?.port ?? null
}
