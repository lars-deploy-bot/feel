import { AppConstants, type ExecutionMode, type SandboxStatus } from "@webalive/database"
import { z } from "zod"

const DomainRuntimeRecordSchema = z.object({
  domain_id: z.string().min(1),
  hostname: z.string().min(1),
  port: z.number().int(),
  is_test_env: z.boolean().nullable(),
  test_run_id: z.string().nullable(),
  execution_mode: z.enum(AppConstants.app.Enums.execution_mode),
  sandbox_id: z.string().nullable(),
  sandbox_status: z.enum(AppConstants.app.Enums.sandbox_status).nullable(),
})

export type DomainRuntimeRecord = z.infer<typeof DomainRuntimeRecordSchema> & {
  execution_mode: ExecutionMode
  sandbox_status: SandboxStatus | null
}

interface DomainRuntimeQueryError {
  code?: string
  message: string
}

interface DomainRuntimeQueryResult {
  data: DomainRuntimeRecord | null
  error?: DomainRuntimeQueryError | null
}

// Keep in sync with apps/web/lib/domain/resolve-domain-runtime.ts DOMAIN_RUNTIME_SELECT
// TODO: extract to @webalive/shared to avoid drift (#DRY)
export const DOMAIN_RUNTIME_SELECT =
  "domain_id, hostname, port, is_test_env, test_run_id, execution_mode, sandbox_id, sandbox_status"

export async function resolveDomainRuntimeQuery(
  hostname: string,
  query: PromiseLike<DomainRuntimeQueryResult>,
): Promise<DomainRuntimeRecord | null> {
  const { data, error } = await query
  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    throw new Error(`Failed to resolve domain runtime for ${hostname}: ${error.message}`)
  }
  return data
}

export interface FetchDomainRuntimeByHostnameInput {
  hostname: string
  supabaseUrl: string
  serviceRoleKey: string
}

export async function fetchDomainRuntimeByHostname(
  input: FetchDomainRuntimeByHostnameInput,
): Promise<DomainRuntimeRecord | null> {
  if (!input.hostname) {
    throw new Error("Domain runtime hostname is required")
  }
  if (!input.supabaseUrl) {
    throw new Error("Supabase URL is required to resolve domain runtime")
  }
  if (!input.serviceRoleKey) {
    throw new Error("Supabase service role key is required to resolve domain runtime")
  }

  const url = new URL("/rest/v1/domains", input.supabaseUrl)
  url.searchParams.set("select", DOMAIN_RUNTIME_SELECT)
  url.searchParams.set("hostname", `eq.${input.hostname}`)

  const response = await fetch(url, {
    headers: {
      "Content-Profile": "app",
      apikey: input.serviceRoleKey,
      Authorization: `Bearer ${input.serviceRoleKey}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to resolve domain runtime for ${input.hostname}: HTTP ${response.status}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows)) {
    throw new Error(`Failed to resolve domain runtime for ${input.hostname}: unexpected response shape`)
  }

  const [record] = rows
  if (!record) {
    return null
  }

  return DomainRuntimeRecordSchema.parse(record)
}
