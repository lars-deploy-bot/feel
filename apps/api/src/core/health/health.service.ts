import { env } from "../../config/env"
import { iam } from "../../db/clients"

const startedAt = Date.now()

export interface HealthStatus {
  ok: boolean
  env: string
  port: number
  uptime_seconds: number
}

export interface DeepHealthStatus extends HealthStatus {
  supabase: boolean
}

export function getHealth(): HealthStatus {
  return {
    ok: true,
    env: env.NODE_ENV,
    port: env.PORT,
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
  }
}

export async function getDeepHealth(): Promise<DeepHealthStatus> {
  const health = getHealth()

  let supabaseOk = false
  try {
    const { error } = await iam.from("orgs").select("org_id").limit(1)
    supabaseOk = !error
  } catch {
    supabaseOk = false
  }

  return {
    ...health,
    ok: health.ok && supabaseOk,
    supabase: supabaseOk,
  }
}
