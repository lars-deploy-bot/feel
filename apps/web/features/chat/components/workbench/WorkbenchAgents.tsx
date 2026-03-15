"use client"

import { Bot, Loader2, RotateCw, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { AgentDetailView } from "./agents/AgentDetailView"
import { AgentEditView } from "./agents/AgentEditView"
import { AgentListView } from "./agents/AgentListView"
import { AgentNav } from "./agents/AgentUI"
import type { AgentView, EnrichedJob, EnrichedJobRaw } from "./agents/agents-types"

function enrichJobs(raw: EnrichedJobRaw[]): EnrichedJob[] {
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

export function WorkbenchAgents({ workspace }: { workspace: string }) {
  const [jobs, setJobs] = useState<EnrichedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<AgentView>({ kind: "list" })
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(
        `/api/automations/enriched?workspace=${encodeURIComponent(workspace)}`,
        { credentials: "include", signal: controller.signal },
      )
      if (controller.signal.aborted) return
      if (!res.ok) throw new Error("Failed to load agents")
      const json = await res.json()
      if (controller.signal.aborted) return
      setJobs(enrichJobs(json.jobs ?? []))
      setError(null)
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "Failed to load agents")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  // If selected job was deleted, go back to list
  const selectedId = view.kind !== "list" ? view.jobId : null
  const selectedJob = selectedId ? jobs.find(j => j.id === selectedId) : null

  useEffect(() => {
    if (selectedId && jobs.length > 0 && !selectedJob) setView({ kind: "list" })
  }, [selectedId, selectedJob, jobs.length])

  const handleNavigate = (kind: AgentView["kind"]) => {
    if (kind === "list") setView({ kind: "list" })
    else if (selectedId) setView({ kind, jobId: selectedId })
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-10 h-10 rounded-lg border border-dashed border-red-200 dark:border-red-500/20 flex items-center justify-center mb-3">
          <TriangleAlert size={16} strokeWidth={1.5} className="text-red-400 dark:text-red-500" />
        </div>
        <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">{error}</p>
        <button type="button" onClick={refresh}
          className="mt-2 inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
          <RotateCw size={12} /> Retry
        </button>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-12 h-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
          <Bot size={20} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
        </div>
        <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">No agents</p>
        <p className="text-[12px] text-zinc-400 dark:text-zinc-600 text-center">
          Create agents in the chat to automate<br />tasks for this workspace.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <AgentNav view={view} hasSelected={selectedJob !== null && selectedJob !== undefined} onNavigate={handleNavigate} />
      <div className="flex-1 overflow-auto">
        {view.kind === "list" && (
          <AgentListView jobs={jobs} onSelect={job => setView({ kind: "detail", jobId: job.id })} onChanged={refresh} refresh={refresh} />
        )}
        {view.kind === "detail" && selectedJob && (
          <AgentDetailView job={selectedJob} onEdit={() => setView({ kind: "edit", jobId: selectedJob.id })} onChanged={refresh} />
        )}
        {view.kind === "edit" && selectedJob && (
          <AgentEditView job={selectedJob} onBack={() => setView({ kind: "detail", jobId: selectedJob.id })} onChanged={refresh} />
        )}
      </div>
    </div>
  )
}
