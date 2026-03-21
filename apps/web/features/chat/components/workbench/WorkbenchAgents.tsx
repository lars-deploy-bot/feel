"use client"

import { Bot, Loader2, Plus, RotateCw, TriangleAlert } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { useWorkbenchContext, type WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { getty } from "@/lib/api/api-client"
import { useAgentCreateStore, usePendingCreate } from "@/lib/stores/agentCreateStore"
import { AgentDetailView } from "./agents/AgentDetailView"
import { AgentEditView } from "./agents/AgentEditView"
import { AgentListView } from "./agents/AgentListView"
import { AgentNav } from "./agents/AgentUI"
import type { AgentView } from "./agents/agents-types"
import { useAgents } from "./agents/useAgents"

const AgentCreateView = dynamic(() => import("./agents/AgentCreateView").then(m => ({ default: m.AgentCreateView })), {
  ssr: false,
})

export function WorkbenchAgents({ workspace }: WorkbenchViewProps) {
  const { jobs, loading, error, refresh } = useAgents(workspace)
  const [view, setView] = useState<AgentView>({ kind: "list" })
  const { onOpenConversation } = useWorkbenchContext()

  const pendingCreate = usePendingCreate()
  const onComplete = useAgentCreateStore(s => s.onComplete)
  const { startCreate, clearCreate } = useAgentCreateStore(s => s.actions)

  // Button-specific fetch state (loading spinner + error)
  const [newLoading, setNewLoading] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)

  // When pending create data arrives (from chat OR button), switch to create view.
  // When it's cleared, go back to list.
  useEffect(() => {
    if (pendingCreate) setView({ kind: "create" })
    else setView(prev => (prev.kind === "create" ? { kind: "list" } : prev))
  }, [pendingCreate])

  const selectedId = view.kind === "detail" || view.kind === "edit" ? view.jobId : null
  const selectedJob = selectedId ? jobs.find(j => j.id === selectedId) : null

  // If selected job was deleted, go back to list
  useEffect(() => {
    if (selectedId && jobs.length > 0 && !selectedJob) setView({ kind: "list" })
  }, [selectedId, selectedJob, jobs.length])

  /** Fetch sites and open create form — used by button, routes through the same store as chat */
  const handleNewAgent = useCallback(async () => {
    setNewLoading(true)
    setNewError(null)
    try {
      const data = await getty("sites")
      const sites = data.sites.map(s => ({ id: s.id, hostname: s.hostname }))
      if (sites.length === 0) throw new Error("No websites available. Create a website first.")
      startCreate({ sites }, () => {})
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "Failed to load sites")
    } finally {
      setNewLoading(false)
    }
  }, [startCreate])

  const handleNavigate = (kind: AgentView["kind"]) => {
    if (kind === "list") setView({ kind: "list" })
    else if (kind === "create" && pendingCreate) setView({ kind: "create" })
    else if (selectedId) setView({ kind, jobId: selectedId })
  }

  const handleCreateDone = useCallback(
    (message: string) => {
      onComplete?.(message)
      clearCreate()
      setView({ kind: "list" })
      refresh()
    },
    [onComplete, clearCreate, refresh],
  )

  const handleCreateCancel = useCallback(() => {
    onComplete?.("User canceled automation configuration.")
    clearCreate()
  }, [onComplete, clearCreate])

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

  if (view.kind === "create" && pendingCreate) {
    return <AgentCreateView data={pendingCreate} onCreated={handleCreateDone} onCancel={handleCreateCancel} />
  }

  if (jobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-12 h-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
          <Bot size={20} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
        </div>
        <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">No agents yet</p>
        <p className="text-[12px] text-zinc-400 dark:text-zinc-600 text-center mb-4">Create one to get started</p>
        {newError && <p className="text-[12px] text-red-500 dark:text-red-400 text-center mb-3">{newError}</p>}
        <button
          type="button"
          onClick={handleNewAgent}
          disabled={newLoading}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 transition-colors"
        >
          {newLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          New agent
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <AgentNav
        view={view}
        hasSelected={selectedJob !== null && selectedJob !== undefined}
        onNavigate={handleNavigate}
        onNewAgent={handleNewAgent}
        newAgentLoading={newLoading}
      />
      {newError && (
        <div className="px-3 py-1.5">
          <p className="text-[11px] text-red-500 dark:text-red-400">{newError}</p>
        </div>
      )}
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
            onOpenConversation={onOpenConversation}
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
