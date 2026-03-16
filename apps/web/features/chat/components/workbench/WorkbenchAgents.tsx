"use client"

import { Bot, Loader2, RotateCw, TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { AgentDetailView } from "./agents/AgentDetailView"
import { AgentEditView } from "./agents/AgentEditView"
import { AgentListView } from "./agents/AgentListView"
import { AgentNav } from "./agents/AgentUI"
import type { AgentView } from "./agents/agents-types"
import { useAgents } from "./agents/useAgents"

export function WorkbenchAgents({ workspace }: WorkbenchViewProps) {
  const { jobs, loading, error, refresh } = useAgents(workspace)
  const [view, setView] = useState<AgentView>({ kind: "list" })

  const selectedId = view.kind !== "list" ? view.jobId : null
  const selectedJob = selectedId ? jobs.find(j => j.id === selectedId) : null

  // If selected job was deleted, go back to list
  useEffect(() => {
    if (selectedId && jobs.length > 0 && !selectedJob) setView({ kind: "list" })
  }, [selectedId, selectedJob, jobs.length])

  const handleNavigate = (kind: AgentView["kind"]) => {
    if (kind === "list") setView({ kind: "list" })
    else if (selectedId) setView({ kind, jobId: selectedId })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-10 h-10 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-3">
          <TriangleAlert size={16} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
        </div>
        <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mb-3">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          <RotateCw size={12} /> Try again
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
        <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">No agents yet</p>
        <p className="text-[12px] text-zinc-400 dark:text-zinc-600 text-center">Ask in the chat to set one up</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <AgentNav
        view={view}
        hasSelected={selectedJob !== null && selectedJob !== undefined}
        onNavigate={handleNavigate}
      />
      <div className="flex-1 overflow-auto">
        {view.kind === "list" && (
          <AgentListView
            jobs={jobs}
            onSelect={job => setView({ kind: "detail", jobId: job.id })}
            onChanged={refresh}
            refresh={refresh}
          />
        )}
        {view.kind === "detail" && selectedJob && (
          <AgentDetailView
            job={selectedJob}
            onEdit={() => setView({ kind: "edit", jobId: selectedJob.id })}
            onChanged={refresh}
          />
        )}
        {view.kind === "edit" && selectedJob && (
          <AgentEditView
            job={selectedJob}
            onBack={() => setView({ kind: "detail", jobId: selectedJob.id })}
            onChanged={refresh}
          />
        )}
      </div>
    </div>
  )
}
