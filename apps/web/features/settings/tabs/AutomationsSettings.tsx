"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Calendar, Globe, Mail, Pause, Play, Plus, Trash2, Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AutomationRunsView } from "@/components/automations/AutomationRunsView"
import { type AutomationFormData, AutomationSidePanel } from "@/components/automations/AutomationSidePanel"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { trackAutomationCreated, trackAutomationDeleted, trackAutomationsViewed } from "@/lib/analytics/events"
import { delly, patchy, postty } from "@/lib/api/api-client"
import { type AutomationRunStatus, type Res, type TriggerType, validateRequest } from "@/lib/api/schemas"
import { buildCreatePayload, buildUpdatePayload } from "@/lib/automation/build-payload"
import { type AutomationJob, useAutomationsQuery, useSitesQuery } from "@/lib/hooks/useSettingsQueries"
import { useCurrentWorkspace, useSelectedOrgId } from "@/lib/stores/workspaceStore"
import { type ApiError, queryKeys } from "@/lib/tanstack"
import { plural } from "../lib/format"
import { SettingsTabLayout } from "./SettingsTabLayout"

const DELETE_CONFIRM_TIMEOUT_MS = 3000

// ─── Helpers ─────────────────────────────────────────────────────────

function relTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function futTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const ms = new Date(dateStr).getTime() - Date.now()
  if (ms < 0) return "Overdue"
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1) return "Now"
  if (mins < 60) return `in ${mins}m`
  if (hrs < 24) return `in ${hrs}h`
  return `in ${days}d`
}

function trigLabel(job: AutomationJob): string {
  switch (job.trigger_type) {
    case "email":
      return job.email_address ? job.email_address : "Email trigger"
    case "webhook":
      return "Webhook"
    case "one-time":
      return "One-time"
    default: {
      if (!job.cron_schedule) return "No schedule"
      const parts = job.cron_schedule.split(" ")
      if (parts.length === 5) {
        const [min, hour, , , weekday] = parts
        if (min === "0" && hour !== "*" && weekday === "*") return `Daily at ${hour}:00`
        if (min === "0" && hour !== "*" && weekday === "1-5") return `Weekdays at ${hour}:00`
        if (min === "0" && hour !== "*" && weekday !== "*") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          const idx = Number(weekday)
          return `${Number.isInteger(idx) && days[idx] ? days[idx] : weekday} at ${hour}:00`
        }
      }
      return job.cron_schedule
    }
  }
}

function StatusDot({ job }: { job: AutomationJob }) {
  if (!job.is_active)
    return <span className="w-2 h-2 rounded-full bg-black/20 dark:bg-white/20 shrink-0" title="Paused" />
  if (job.status === "running")
    return <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" title="Running" />
  if (job.last_run_status === "failure")
    return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Last run failed" />
  return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Active" />
}

// ─── Detail tabs ─────────────────────────────────────────────────────

type DetailTab = "overview" | "runs" | "edit"
const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "runs", label: "Runs" },
  { id: "edit", label: "Edit" },
]

// ─── Main component ──────────────────────────────────────────────────

export function AutomationsSettings() {
  const queryClient = useQueryClient()
  const currentWorkspace = useCurrentWorkspace()
  const selectedOrgId = useSelectedOrgId()
  const { data: sitesData, isLoading: sitesLoading } = useSitesQuery()

  const [projectOnly, setProjectOnly] = useState(false)

  // Always fetch org-level — filter client-side for "Only this project"
  const queryFilter = useMemo(
    (): { orgId?: string } => (selectedOrgId ? { orgId: selectedOrgId } : {}),
    [selectedOrgId],
  )

  const {
    data: rawAutomationsData,
    isLoading: automationsLoading,
    error: automationsError,
  } = useAutomationsQuery(queryFilter)

  // Client-side filter by hostname — instant, no extra API call
  const automationsData = useMemo(() => {
    if (!rawAutomationsData) return rawAutomationsData
    if (!projectOnly || !currentWorkspace) return rawAutomationsData
    return {
      automations: rawAutomationsData.automations.filter(a => a.hostname === currentWorkspace),
    }
  }, [rawAutomationsData, projectOnly, currentWorkspace])

  const loading = automationsLoading || sitesLoading

  useEffect(() => {
    trackAutomationsViewed()
  }, [])

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>("overview")

  // Derive selected job from query data — always fresh, auto-clears on deletion
  const selectedJob =
    selectedJobId && automationsData ? (automationsData.automations.find(a => a.id === selectedJobId) ?? null) : null

  // ─── Mutations ──────────────────────────────

  const toggleMutation = useMutation<
    Res<"automations/update">,
    ApiError,
    { id: string; active: boolean },
    { previous: unknown }
  >({
    mutationFn: ({ id, active }) => {
      const body = validateRequest("automations/update", { is_active: active })
      return patchy("automations/update", body, undefined, `/api/automations/${id}`)
    },
    onMutate: async ({ id, active }) => {
      const key = queryKeys.automations.list(queryFilter)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData<{ automations: AutomationJob[] }>(key, old =>
        old ? { automations: old.automations.map(a => (a.id === id ? { ...a, is_active: active } : a)) } : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.automations.list(queryFilter), context.previous)
    },
  })

  const saveMutation = useMutation<unknown, ApiError, { formData: AutomationFormData; editingJobId?: string }>({
    mutationFn: ({ formData, editingJobId }) => {
      if (editingJobId) {
        const body = buildUpdatePayload(formData, formData.trigger_type)
        return patchy("automations/update", body, undefined, `/api/automations/${editingJobId}`)
      }

      const body = buildCreatePayload(formData)
      return postty("automations/create", body)
    },
    onSuccess: (_data, variables) => {
      if (!variables.editingJobId) {
        trackAutomationCreated({ has_prompt: !!variables.formData.action_prompt })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
      setSelectedJobId(null)
      setIsCreating(false)
    },
    onError: (err: ApiError) => {
      alert(err.message)
    },
  })

  const deleteMutation = useMutation<Res<"automations/delete">, ApiError, string, { previous: unknown }>({
    mutationFn: (id: string) => delly("automations/delete", undefined, `/api/automations/${id}`),
    onMutate: async id => {
      const key = queryKeys.automations.list(queryFilter)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData<{ automations: AutomationJob[] }>(key, old =>
        old ? { automations: old.automations.filter(a => a.id !== id) } : old,
      )
      return { previous }
    },
    onError: (err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.automations.list(queryFilter), context.previous)
      alert(err.message || "Failed to delete automation")
    },
    onSuccess: () => {
      trackAutomationDeleted()
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
      setSelectedJobId(null)
    },
    onSettled: () => setDeleteConfirm(null),
  })

  const triggerMutation = useMutation<Res<"automations/trigger">, ApiError, string>({
    mutationFn: (id: string) => {
      const body = validateRequest("automations/trigger", {})
      return postty("automations/trigger", body, undefined, `/api/automations/${id}/trigger`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
    },
    onError: (err: ApiError) => {
      alert(err.message)
    },
  })

  // ─── Callbacks ──────────────────────────────

  const handleCreate = useCallback(() => {
    setSelectedJobId(null)
    setIsCreating(true)
  }, [])

  const handleSelectJob = useCallback((job: AutomationJob) => {
    setSelectedJobId(job.id)
    setIsCreating(false)
    setDetailTab("overview")
  }, [])

  const handleBack = useCallback(() => {
    setSelectedJobId(null)
    setIsCreating(false)
  }, [])

  const handleSave = useCallback(
    async (formData: AutomationFormData) => {
      saveMutation.mutate({ formData, editingJobId: selectedJob?.id })
    },
    [selectedJob, saveMutation],
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (deleteConfirm !== id) {
        setDeleteConfirm(id)
        return
      }
      deleteMutation.mutate(id)
    },
    [deleteConfirm, deleteMutation],
  )

  useEffect(() => {
    if (deleteConfirm) {
      const timeout = setTimeout(() => setDeleteConfirm(null), DELETE_CONFIRM_TIMEOUT_MS)
      return () => clearTimeout(timeout)
    }
  }, [deleteConfirm])

  // ─── Loading / Error ──────────────────────────────

  if (loading) {
    return (
      <SettingsTabLayout title="Agents" description="Loading...">
        <LoadingSpinner message="Loading agents..." />
      </SettingsTabLayout>
    )
  }

  if (automationsError) {
    console.error("[AutomationsSettings] Failed to load agents:", automationsError.message)
    return (
      <SettingsTabLayout title="Agents" description="Schedule recurring tasks">
        <EmptyState icon={Zap} message="Failed to load agents" />
      </SettingsTabLayout>
    )
  }

  // After loading/error guards, data is guaranteed
  if (!automationsData || !sitesData) return null
  const { automations } = automationsData
  const { sites } = sitesData
  const activeCount = automations.filter(a => a.is_active).length

  // ─── Create view ──────────────────────────────

  if (isCreating) {
    return (
      <SettingsTabLayout title="Agents" description="Create a new agent">
        <div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to agents
          </button>
          <div className="max-w-2xl">
            <AutomationSidePanel
              isOpen={true}
              onClose={handleBack}
              sites={sites}
              editingJob={null}
              onSave={handleSave}
              saving={saveMutation.isPending}
            />
          </div>
        </div>
      </SettingsTabLayout>
    )
  }

  // ─── Detail view ──────────────────────────────

  if (selectedJob) {
    return (
      <SettingsTabLayout
        title="Agents"
        description={`${activeCount} active agent${plural(activeCount)}`}
        className="h-full min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        {/* Header: Back + name + status */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 -ml-1.5 rounded-md text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <StatusDot job={selectedJob} />
          <h2 className="text-base font-semibold text-black dark:text-white truncate">{selectedJob.name}</h2>
          {selectedJob.hostname && (
            <span className="text-xs text-black/40 dark:text-white/40 truncate">{selectedJob.hostname}</span>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => toggleMutation.mutate({ id: selectedJob.id, active: !selectedJob.is_active })}
            disabled={toggleMutation.isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedJob.is_active
                ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/30"
                : "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30"
            }`}
          >
            {selectedJob.is_active ? <Pause size={14} /> : <Play size={14} />}
            {selectedJob.is_active ? "Pause" : "Resume"}
          </button>

          <button
            type="button"
            onClick={() => triggerMutation.mutate(selectedJob.id)}
            disabled={triggerMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Zap size={14} />
            {triggerMutation.isPending ? "Running..." : "Run Now"}
          </button>

          <button
            type="button"
            onClick={() => handleDelete(selectedJob.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-auto ${
              deleteConfirm === selectedJob.id
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-100/50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
            }`}
          >
            <Trash2 size={14} />
            {deleteConfirm === selectedJob.id ? "Confirm Delete" : "Delete"}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg p-0.5 mb-4 w-fit">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === tab.id
                  ? "bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm"
                  : "text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {detailTab === "overview" && <OverviewTab job={selectedJob} />}
          {detailTab === "runs" && <AutomationRunsView job={selectedJob} />}
          {detailTab === "edit" && (
            <div className="max-w-2xl h-full">
              <AutomationSidePanel
                isOpen={true}
                onClose={handleBack}
                sites={sites}
                editingJob={selectedJob}
                onSave={handleSave}
                saving={saveMutation.isPending}
              />
            </div>
          )}
        </div>
      </SettingsTabLayout>
    )
  }

  // ─── List view (default) ──────────────────────────────

  if (automations.length === 0) {
    return (
      <SettingsTabLayout
        title="Agents"
        description="Schedule recurring tasks for your websites"
        action={{ label: "Add Agent", icon: <Plus size={16} />, onClick: handleCreate }}
      >
        <ProjectFilterToggle
          show={!!currentWorkspace}
          active={projectOnly}
          onToggle={() => setProjectOnly(!projectOnly)}
        />
        <EmptyState
          icon={Zap}
          message={
            projectOnly
              ? "No agents for this project. Agents let you schedule recurring tasks like syncing calendars or running AI prompts."
              : "No agents yet. Agents let you schedule recurring tasks like syncing calendars or running AI prompts."
          }
          action={{ label: "Create Agent", onClick: handleCreate }}
        />
      </SettingsTabLayout>
    )
  }

  return (
    <SettingsTabLayout
      title="Agents"
      description={`${activeCount} active agent${plural(activeCount)}`}
      action={{ label: "Add Agent", icon: <Plus size={16} />, onClick: handleCreate }}
      className="h-full min-h-0 flex flex-col"
      contentClassName="flex-1 min-h-0"
    >
      <ProjectFilterToggle
        show={!!currentWorkspace}
        active={projectOnly}
        onToggle={() => setProjectOnly(!projectOnly)}
      />

      {/* Table */}
      <div className="overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
              <th className="pb-2 pr-4 text-xs font-medium text-black/50 dark:text-white/50">Agent</th>
              <th className="pb-2 pr-4 text-xs font-medium text-black/50 dark:text-white/50 hidden sm:table-cell">
                Trigger
              </th>
              <th className="pb-2 pr-4 text-xs font-medium text-black/50 dark:text-white/50 hidden md:table-cell">
                Next run
              </th>
              <th className="pb-2 text-xs font-medium text-black/50 dark:text-white/50 hidden lg:table-cell">
                Last run
              </th>
            </tr>
          </thead>
          <tbody>
            {automations.map(job => (
              <tr
                key={job.id}
                onClick={() => handleSelectJob(job)}
                className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                {/* Agent column */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <StatusDot job={job} />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${job.is_active ? "text-black dark:text-white" : "text-black/50 dark:text-white/50"}`}
                      >
                        {job.name}
                      </p>
                      {job.hostname && (
                        <p className="text-xs text-black/40 dark:text-white/40 truncate flex items-center gap-1 mt-0.5">
                          <Globe size={10} className="shrink-0" />
                          {job.hostname}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Trigger column */}
                <td className="py-3 pr-4 hidden sm:table-cell">
                  <span className="text-xs text-black/60 dark:text-white/60 flex items-center gap-1.5">
                    <TriggerIcon type={job.trigger_type} />
                    {trigLabel(job)}
                  </span>
                </td>

                {/* Next run column */}
                <td className="py-3 pr-4 hidden md:table-cell">
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {job.is_active ? futTime(job.next_run_at) : "Paused"}
                  </span>
                </td>

                {/* Last run column */}
                <td className="py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-black/50 dark:text-white/50">{relTime(job.last_run_at)}</span>
                    {job.last_run_status && <RunStatusBadge status={job.last_run_status} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsTabLayout>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function ProjectFilterToggle({ show, active, onToggle }: { show: boolean; active: boolean; onToggle: () => void }) {
  if (!show) return null
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          active
            ? "bg-black/[0.08] dark:bg-white/[0.08] text-black dark:text-white"
            : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
        }`}
      >
        <Globe size={12} />
        Only this project
      </button>
    </div>
  )
}

function TriggerIcon({ type }: { type: TriggerType }) {
  switch (type) {
    case "email":
      return <Mail size={12} className="shrink-0 text-black/40 dark:text-white/40" />
    case "webhook":
      return <Zap size={12} className="shrink-0 text-black/40 dark:text-white/40" />
    default:
      return <Calendar size={12} className="shrink-0 text-black/40 dark:text-white/40" />
  }
}

const STATUS_STYLES: Record<AutomationRunStatus, string> = {
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  failure: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  running: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  skipped: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400",
}

function RunStatusBadge({ status }: { status: AutomationRunStatus }) {
  return <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${STATUS_STYLES[status]}`}>{status}</span>
}

function OverviewTab({ job }: { job: AutomationJob }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Status", value: job.is_active ? "Active" : "Paused" },
    { label: "Trigger", value: trigLabel(job) },
  ]

  if (job.cron_timezone) {
    rows.push({ label: "Timezone", value: job.cron_timezone })
  }

  rows.push({ label: "Next run", value: job.is_active ? futTime(job.next_run_at) : "Paused" })
  rows.push({
    label: "Last run",
    value: (
      <span className="flex items-center gap-2">
        {relTime(job.last_run_at)}
        {job.last_run_status && <RunStatusBadge status={job.last_run_status} />}
      </span>
    ),
  })

  if (job.action_prompt) {
    rows.push({
      label: "Prompt",
      value: (
        <pre className="text-xs whitespace-pre-wrap text-black/70 dark:text-white/70 font-mono bg-black/[0.03] dark:bg-white/[0.03] rounded-md p-2 max-h-48 overflow-y-auto">
          {job.action_prompt}
        </pre>
      ),
    })
  }

  if (job.action_model) {
    rows.push({ label: "Model", value: job.action_model })
  }

  if (job.action_timeout_seconds) {
    rows.push({ label: "Timeout", value: `${job.action_timeout_seconds}s` })
  }

  if (job.skills && job.skills.length > 0) {
    rows.push({
      label: "Skills",
      value: (
        <div className="flex flex-wrap gap-1">
          {job.skills.map(s => (
            <span
              key={s}
              className="px-2 py-0.5 text-[11px] rounded-full bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70"
            >
              {s}
            </span>
          ))}
        </div>
      ),
    })
  }

  if (job.description) {
    rows.push({ label: "Description", value: job.description })
  }

  return (
    <div className="overflow-y-auto h-full px-0.5">
      <dl className="space-y-4">
        {rows.map(row => (
          <div key={row.label}>
            <dt className="text-xs font-medium text-black/50 dark:text-white/50 mb-1">{row.label}</dt>
            <dd className="text-sm text-black/90 dark:text-white/90">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
