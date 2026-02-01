"use client"

import { Calendar, Clock, Globe, Pause, Pencil, Play, Plus, RefreshCw, Trash2, Zap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Modal } from "@/components/ui/Modal"
import { SettingsTabLayout } from "./SettingsTabLayout"

type AutomationJob = {
  id: string
  site_id: string
  name: string
  description: string | null
  trigger_type: "cron" | "webhook" | "one-time"
  cron_schedule: string | null
  cron_timezone: string | null
  run_at: string | null
  action_type: "prompt" | "sync" | "publish"
  action_prompt: string | null
  action_source: string | null
  action_target_page: string | null
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  created_at: string
  hostname?: string
}

type Site = {
  id: string
  hostname: string
  org_id: string
}

type FormData = {
  site_id: string
  name: string
  description: string
  trigger_type: "cron" | "webhook" | "one-time"
  cron_schedule: string
  cron_timezone: string
  run_at: string
  action_type: "prompt" | "sync" | "publish"
  action_prompt: string
  action_source: string
  action_target_page: string
  is_active: boolean
}

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at 6am", value: "0 6 * * *" },
  { label: "Daily at 9am", value: "0 9 * * *" },
  { label: "Daily at noon", value: "0 12 * * *" },
  { label: "Daily at 6pm", value: "0 18 * * *" },
  { label: "Weekly (Mon 9am)", value: "0 9 * * 1" },
  { label: "Weekly (Fri 5pm)", value: "0 17 * * 5" },
  { label: "Custom", value: "custom" },
]

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "Amsterdam (CET)", value: "Europe/Amsterdam" },
  { label: "London (GMT)", value: "Europe/London" },
  { label: "New York (EST)", value: "America/New_York" },
  { label: "Los Angeles (PST)", value: "America/Los_Angeles" },
]

function formatSchedule(job: AutomationJob): string {
  if (job.trigger_type === "one-time") {
    return "One-time"
  }
  if (job.trigger_type === "webhook") {
    return "Webhook trigger"
  }
  if (job.cron_schedule) {
    // Simple cron descriptions
    const parts = job.cron_schedule.split(" ")
    if (parts.length === 5) {
      const [min, hour, day, month, weekday] = parts
      if (min === "0" && hour !== "*" && day === "*" && month === "*" && weekday === "*") {
        return `Daily at ${hour}:00`
      }
      if (min === "0" && hour !== "*" && weekday !== "*" && day === "*") {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return `${days[parseInt(weekday, 10)] || "Weekly"} at ${hour}:00`
      }
    }
    return job.cron_schedule
  }
  return "Unknown"
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatNextRun(dateStr: string | null): string {
  if (!dateStr) return "Not scheduled"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMs < 0) return "Overdue"
  if (diffMins < 60) return `in ${diffMins}m`
  if (diffHours < 24) return `in ${diffHours}h`
  if (diffDays < 7) return `in ${diffDays}d`
  return date.toLocaleDateString()
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null

  const styles: Record<string, string> = {
    success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    failure: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    running: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    skipped: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.pending}`}>{status}</span>
  )
}

function ActionTypeBadge({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    prompt: <Zap size={12} />,
    sync: <RefreshCw size={12} />,
    publish: <Globe size={12} />,
  }

  const labels: Record<string, string> = {
    prompt: "AI Prompt",
    sync: "Data Sync",
    publish: "Publish",
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60">
      {icons[type]}
      {labels[type] || type}
    </span>
  )
}

function AutomationCard({
  job,
  onToggle,
  onEdit,
  onDelete,
}: {
  job: AutomationJob
  onToggle: (id: string, active: boolean) => void
  onEdit: (job: AutomationJob) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        job.is_active
          ? "bg-white dark:bg-white/5 border-black/10 dark:border-white/10"
          : "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-black dark:text-white truncate">{job.name}</h4>
            <ActionTypeBadge type={job.action_type} />
          </div>

          {job.hostname && (
            <p className="text-xs text-black/50 dark:text-white/50 mb-2 truncate">
              <Globe size={11} className="inline mr-1" />
              {job.hostname}
            </p>
          )}

          {job.description && (
            <p className="text-sm text-black/60 dark:text-white/60 mb-3 line-clamp-2">{job.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/50 dark:text-white/50">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {formatSchedule(job)}
            </span>

            {job.last_run_at && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Last: {formatRelativeTime(job.last_run_at)}
                {job.last_run_status && <StatusBadge status={job.last_run_status} />}
              </span>
            )}

            {job.is_active && job.next_run_at && (
              <span className="inline-flex items-center gap-1">Next: {formatNextRun(job.next_run_at)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(job)}
            className="p-2 rounded-lg transition-all bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/20"
            title="Edit automation"
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            onClick={() => onToggle(job.id, !job.is_active)}
            className={`p-2 rounded-lg transition-all ${
              job.is_active
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/20"
            }`}
            title={job.is_active ? "Pause automation" : "Resume automation"}
          >
            {job.is_active ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            type="button"
            onClick={() => onDelete(job.id)}
            className="p-2 rounded-lg transition-all bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
            title="Delete automation"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AutomationFormModal({
  isOpen,
  onClose,
  sites,
  editingJob,
  onSave,
  saving,
}: {
  isOpen: boolean
  onClose: () => void
  sites: Site[]
  editingJob: AutomationJob | null
  onSave: (data: FormData) => Promise<void>
  saving: boolean
}) {
  const [formData, setFormData] = useState<FormData>({
    site_id: "",
    name: "",
    description: "",
    trigger_type: "cron",
    cron_schedule: "0 9 * * *",
    cron_timezone: "Europe/Amsterdam",
    run_at: "",
    action_type: "prompt",
    action_prompt: "",
    action_source: "",
    action_target_page: "",
    is_active: true,
  })
  const [cronPreset, setCronPreset] = useState("0 9 * * *")
  const [siteSearch, setSiteSearch] = useState("")
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false)

  const filteredSites = sites.filter(s => s.hostname.toLowerCase().includes(siteSearch.toLowerCase()))

  // Reset form when modal opens/closes or editing job changes
  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        setFormData({
          site_id: editingJob.site_id,
          name: editingJob.name,
          description: editingJob.description || "",
          trigger_type: editingJob.trigger_type,
          cron_schedule: editingJob.cron_schedule || "0 9 * * *",
          cron_timezone: editingJob.cron_timezone || "Europe/Amsterdam",
          run_at: editingJob.run_at || "",
          action_type: editingJob.action_type,
          action_prompt: editingJob.action_prompt || "",
          action_source: editingJob.action_source || "",
          action_target_page: editingJob.action_target_page || "",
          is_active: editingJob.is_active,
        })
        const preset = CRON_PRESETS.find(p => p.value === editingJob.cron_schedule)
        setCronPreset(preset ? preset.value : "custom")
        const site = sites.find(s => s.id === editingJob.site_id)
        setSiteSearch(site?.hostname || "")
      } else {
        setFormData({
          site_id: "",
          name: "",
          description: "",
          trigger_type: "cron",
          cron_schedule: "0 9 * * *",
          cron_timezone: "Europe/Amsterdam",
          run_at: "",
          action_type: "prompt",
          action_prompt: "",
          action_source: "",
          action_target_page: "",
          is_active: true,
        })
        setCronPreset("0 9 * * *")
        setSiteSearch("")
      }
      setSiteDropdownOpen(false)
    }
  }, [isOpen, editingJob, sites])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(formData)
  }

  const handleCronPresetChange = (value: string) => {
    setCronPreset(value)
    if (value !== "custom") {
      setFormData(prev => ({ ...prev, cron_schedule: value }))
    }
  }

  const inputClass =
    "w-full px-2.5 py-1.5 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20"
  const labelClass = "block text-xs font-medium text-black/70 dark:text-white/70 mb-1"

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingJob ? "Edit Automation" : "New Automation"} size="sm">
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Row 1: Site + Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label htmlFor="automation-website" className={labelClass}>
              Website
            </label>
            <input
              id="automation-website"
              type="text"
              value={siteSearch}
              onChange={e => {
                setSiteSearch(e.target.value)
                setSiteDropdownOpen(true)
                if (!e.target.value) {
                  setFormData(prev => ({ ...prev, site_id: "" }))
                }
              }}
              onFocus={() => setSiteDropdownOpen(true)}
              onBlur={() => setTimeout(() => setSiteDropdownOpen(false), 150)}
              placeholder="Type to search..."
              className={inputClass}
              required={!formData.site_id}
            />
            {siteDropdownOpen && filteredSites.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-32 overflow-auto rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-lg">
                {filteredSites.slice(0, 6).map(site => (
                  <button
                    key={site.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      setFormData(prev => ({ ...prev, site_id: site.id }))
                      setSiteSearch(site.hostname)
                      setSiteDropdownOpen(false)
                    }}
                    className={`w-full px-2.5 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                      formData.site_id === site.id ? "bg-black/5 dark:bg-white/10" : ""
                    }`}
                  >
                    {site.hostname}
                  </button>
                ))}
              </div>
            )}
            {/* Hidden input for form validation */}
            <input type="hidden" name="site_id" value={formData.site_id} required />
          </div>
          <div>
            <label htmlFor="automation-name" className={labelClass}>
              Name
            </label>
            <input
              id="automation-name"
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Daily update"
              className={inputClass}
              required
            />
          </div>
        </div>

        {/* Row 2: Schedule + Timezone (for cron) */}
        {formData.trigger_type === "cron" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="automation-schedule" className={labelClass}>
                Schedule
              </label>
              <select
                id="automation-schedule"
                value={cronPreset}
                onChange={e => handleCronPresetChange(e.target.value)}
                className={inputClass}
              >
                {CRON_PRESETS.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="automation-timezone" className={labelClass}>
                Timezone
              </label>
              <select
                id="automation-timezone"
                value={formData.cron_timezone}
                onChange={e => setFormData(prev => ({ ...prev, cron_timezone: e.target.value }))}
                className={inputClass}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Custom cron */}
        {formData.trigger_type === "cron" && cronPreset === "custom" && (
          <div>
            <label htmlFor="automation-cron" className={labelClass}>
              Cron Expression
            </label>
            <input
              id="automation-cron"
              type="text"
              value={formData.cron_schedule}
              onChange={e => setFormData(prev => ({ ...prev, cron_schedule: e.target.value }))}
              placeholder="0 9 * * *"
              className={`${inputClass} font-mono`}
              required
            />
          </div>
        )}

        {/* One-time date */}
        {formData.trigger_type === "one-time" && (
          <div>
            <label htmlFor="automation-run-at" className={labelClass}>
              Run At
            </label>
            <input
              id="automation-run-at"
              type="datetime-local"
              value={formData.run_at}
              onChange={e => setFormData(prev => ({ ...prev, run_at: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
        )}

        {/* Prompt */}
        {formData.action_type === "prompt" && (
          <div>
            <label htmlFor="automation-prompt" className={labelClass}>
              Prompt
            </label>
            <textarea
              id="automation-prompt"
              value={formData.action_prompt}
              onChange={e => setFormData(prev => ({ ...prev, action_prompt: e.target.value }))}
              placeholder="Update the blog with a new article..."
              rows={3}
              className={`${inputClass} resize-none`}
              required
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingJob ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AutomationsSettings() {
  const [automations, setAutomations] = useState<AutomationJob[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<AutomationJob | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/automations", { credentials: "include" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch automations")
      }

      setAutomations(data.automations || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch("/api/sites", { credentials: "include" })
      const data = await res.json()
      if (res.ok) {
        setSites(data.sites || [])
      }
    } catch {
      // Ignore site fetch errors
    }
  }, [])

  useEffect(() => {
    fetchAutomations()
    fetchSites()
  }, [fetchAutomations, fetchSites])

  const handleToggle = useCallback(async (id: string, active: boolean) => {
    // Optimistic update
    setAutomations(prev => prev.map(a => (a.id === id ? { ...a, is_active: active } : a)))

    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
        credentials: "include",
      })

      if (!res.ok) {
        // Revert on error
        setAutomations(prev => prev.map(a => (a.id === id ? { ...a, is_active: !active } : a)))
      }
    } catch {
      // Revert on error
      setAutomations(prev => prev.map(a => (a.id === id ? { ...a, is_active: !active } : a)))
    }
  }, [])

  const handleEdit = useCallback((job: AutomationJob) => {
    setEditingJob(job)
    setModalOpen(true)
  }, [])

  const handleCreate = useCallback(() => {
    setEditingJob(null)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback(
    async (formData: FormData) => {
      setSaving(true)
      try {
        const url = editingJob ? `/api/automations/${editingJob.id}` : "/api/automations"
        const method = editingJob ? "PATCH" : "POST"

        const body: Record<string, unknown> = {
          name: formData.name,
          description: formData.description || null,
          is_active: formData.is_active,
        }

        if (!editingJob) {
          body.site_id = formData.site_id
          body.trigger_type = formData.trigger_type
          body.action_type = formData.action_type
        }

        if (formData.trigger_type === "cron") {
          body.cron_schedule = formData.cron_schedule
          body.cron_timezone = formData.cron_timezone
        } else if (formData.trigger_type === "one-time") {
          body.run_at = new Date(formData.run_at).toISOString()
        }

        if (formData.action_type === "prompt") {
          body.action_prompt = formData.action_prompt
        }

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to save automation")
        }

        setModalOpen(false)
        setEditingJob(null)
        fetchAutomations()
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save")
      } finally {
        setSaving(false)
      }
    },
    [editingJob, fetchAutomations],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (deleteConfirm !== id) {
        setDeleteConfirm(id)
        return
      }

      try {
        const res = await fetch(`/api/automations/${id}`, {
          method: "DELETE",
          credentials: "include",
        })

        if (res.ok) {
          setAutomations(prev => prev.filter(a => a.id !== id))
        }
      } catch {
        // Ignore delete errors
      } finally {
        setDeleteConfirm(null)
      }
    },
    [deleteConfirm],
  )

  // Reset delete confirmation when clicking elsewhere
  useEffect(() => {
    if (deleteConfirm) {
      const timeout = setTimeout(() => setDeleteConfirm(null), 3000)
      return () => clearTimeout(timeout)
    }
  }, [deleteConfirm])

  const activeCount = automations.filter(a => a.is_active).length

  const renderContent = () => {
    if (loading) return <LoadingSpinner message="Loading automations..." />
    if (error) return <EmptyState icon={Zap} message={error} />
    if (automations.length === 0) {
      return (
        <EmptyState
          icon={Zap}
          message="No automations yet. Automations let you schedule recurring tasks like syncing calendars or running AI prompts."
          action={{
            label: "Create Automation",
            onClick: handleCreate,
          }}
        />
      )
    }

    return (
      <div className="space-y-3">
        {automations.map(job => (
          <AutomationCard key={job.id} job={job} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>
    )
  }

  return (
    <SettingsTabLayout
      title="Automations"
      description={
        automations.length > 0
          ? `${activeCount} active automation${activeCount !== 1 ? "s" : ""} across your sites`
          : "Schedule recurring tasks for your websites"
      }
      action={
        automations.length > 0
          ? {
              label: "Add Automation",
              icon: <Plus size={16} />,
              onClick: handleCreate,
            }
          : undefined
      }
    >
      <div className="space-y-4">{renderContent()}</div>

      <AutomationFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingJob(null)
        }}
        sites={sites}
        editingJob={editingJob}
        onSave={handleSave}
        saving={saving}
      />
    </SettingsTabLayout>
  )
}
