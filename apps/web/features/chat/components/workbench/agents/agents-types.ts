import type { Res } from "@/lib/api/schemas"

/** Single job from the enriched API response */
export type EnrichedJobRaw = Res<"automations/enriched">["jobs"][number]

/** Enriched job with client-computed fields */
export interface EnrichedJob extends EnrichedJobRaw {
  success_rate: number
  streak: number
}

/** Recent run from enriched response */
export type RecentRun = EnrichedJobRaw["recent_runs"][number]

export type AgentView = { kind: "list" } | { kind: "detail"; jobId: string } | { kind: "edit"; jobId: string }
