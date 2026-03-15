"use client"

import { useCallback } from "react"
import type { Res } from "@/lib/api/schemas"
import { fetcher, queryKeys, useQuery, useQueryClient } from "@/lib/tanstack"
import type { EnrichedJob } from "./agents-types"

type EnrichedResponse = Res<"automations/enriched">

function enrichJobs(raw: EnrichedResponse["jobs"]): EnrichedJob[] {
  return raw.map(job => {
    const rate = job.runs_30d > 0 ? Math.round((job.success_runs_30d / job.runs_30d) * 100) : 0
    let streak = 0
    for (const r of job.recent_runs) {
      if (r.status === "success") streak++
      else break
    }
    return { ...job, success_rate: rate, streak }
  })
}

export function useAgents(workspace: string) {
  const queryClient = useQueryClient()

  const {
    data: jobs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.automations.enriched(workspace),
    queryFn: () =>
      fetcher<EnrichedResponse>(`/api/automations/enriched?workspace=${encodeURIComponent(workspace)}`).then(res =>
        enrichJobs(res.jobs),
      ),
    staleTime: 30_000,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.automations.enriched(workspace) })
  }, [queryClient, workspace])

  return {
    jobs,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load agents") : null,
    refresh,
  }
}
