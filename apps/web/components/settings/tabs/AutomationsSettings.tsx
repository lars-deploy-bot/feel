"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Book,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Modal } from "@/components/ui/Modal"
import {
  useAutomationsQuery,
  useAutomationRunsQuery,
  useSitesQuery,
  type AutomationJob,
  type AutomationRun,
  type Site,
} from "@/lib/hooks/useSettingsQueries"
import { queryKeys, ApiError } from "@/lib/tanstack"
import { SettingsTabLayout } from "./SettingsTabLayout"

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
  skills: string[]
  is_active: boolean
}

type SkillItem = {
  id: string
  displayName: string
  description: string
}

const _CRON_PRESETS = [
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

function RunHistoryModal({
  isOpen,
  onClose,
  job,
}: {
  isOpen: boolean
  onClose: () => void
  job: AutomationJob | null
}) {
  const { data, isLoading, error } = useAutomationRunsQuery(job?.id ?? null)

  if (!job) return null

  const runs = data?.runs ?? []

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 size={16} className="text-green-500" />
      case "failure":
        return <XCircle size={16} className="text-red-500" />
      case "running":
        return <RefreshCw size={16} className="text-blue-500 animate-spin" />
      case "pending":
        return <Clock size={16} className="text-yellow-500" />
      default:
        return <AlertCircle size={16} className="text-gray-400" />
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Run History: ${job.name}`} size="md">
      <div className="p-4">
        {isLoading && <LoadingSpinner message="Loading run history..." />}

        {error && (
          <div className="text-center py-8 text-red-500">
            <AlertCircle size={24} className="mx-auto mb-2" />
            <p>Failed to load run history</p>
          </div>
        )}

        {!isLoading && !error && runs.length === 0 && (
          <div className="text-center py-8 text-black/50 dark:text-white/50">
            <History size={32} className="mx-auto mb-2 opacity-50" />
            <p>No runs yet</p>
            <p className="text-sm mt-1">This automation hasn't been executed.</p>
          </div>
        )}

        {!isLoading && !error && runs.length > 0 && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {runs.map(run => (
              <div
                key={run.id}
                className={`p-3 rounded-lg border ${
                  run.status === "failure"
                    ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30"
                    : run.status === "success"
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30"
                      : "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getStatusIcon(run.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-black dark:text-white capitalize">{run.status}</span>
                      <span className="text-xs text-black/50 dark:text-white/50">{formatTime(run.started_at)}</span>
                    </div>

                    {run.duration_ms !== null && (
                      <p className="text-xs text-black/50 dark:text-white/50 mb-1">
                        Duration:{" "}
                        {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
                      </p>
                    )}

                    {run.triggered_by && (
                      <p className="text-xs text-black/50 dark:text-white/50 mb-1">Triggered by: {run.triggered_by}</p>
                    )}

                    {run.error && (
                      <div className="mt-2 p-2 rounded bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error:</p>
                        <p className="text-xs text-red-600 dark:text-red-300 font-mono break-all whitespace-pre-wrap">
                          {run.error}
                        </p>
                      </div>
                    )}

                    {run.changes_made && run.changes_made.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-black/70 dark:text-white/70 mb-1">Changes made:</p>
                        <ul className="text-xs text-black/50 dark:text-white/50 list-disc list-inside">
                          {run.changes_made.map((change, i) => (
                            <li key={i}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function AutomationCard({
  job,
  onToggle,
  onEdit,
  onDelete,
  onViewHistory,
}: {
  job: AutomationJob
  onToggle: (id: string, active: boolean) => void
  onEdit: (job: AutomationJob) => void
  onDelete: (id: string) => void
  onViewHistory: (job: AutomationJob) => void
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
        <button
          type="button"
          onClick={() => onViewHistory(job)}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer"
        >
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
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onViewHistory(job)}
            className="p-2 rounded-lg transition-all bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/20"
            title="View run history"
          >
            <History size={16} />
          </button>

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

// =============================================================================
// AUTOMATION TEMPLATES - Pre-built recipes for common use cases
// =============================================================================

type AutomationTemplate = {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  category: "content" | "maintenance" | "monitoring"
  defaults: Partial<FormData>
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "daily-blog",
    icon: <Pencil size={20} />,
    title: "Daily Blog Post",
    description: "Write and publish a new blog post every day",
    category: "content",
    defaults: {
      name: "Daily Blog Post",
      trigger_type: "cron",
      cron_schedule: "0 9 * * *",
      action_type: "prompt",
      action_prompt:
        "Write and publish a new blog post about a topic relevant to our audience. Make it engaging, informative, and optimized for SEO.",
    },
  },
  {
    id: "weekly-newsletter",
    icon: <Calendar size={20} />,
    title: "Weekly Summary",
    description: "Generate a weekly recap or newsletter",
    category: "content",
    defaults: {
      name: "Weekly Summary",
      trigger_type: "cron",
      cron_schedule: "0 9 * * 1",
      action_type: "prompt",
      action_prompt:
        "Create a weekly summary of the most important updates, news, or content from the past week. Format it nicely for the website.",
    },
  },
  {
    id: "content-refresh",
    icon: <RefreshCw size={20} />,
    title: "Content Refresh",
    description: "Update outdated content to keep it fresh",
    category: "maintenance",
    defaults: {
      name: "Content Refresh",
      trigger_type: "cron",
      cron_schedule: "0 10 * * 3",
      action_type: "prompt",
      action_prompt:
        "Review the website content and update any outdated information. Check for broken links, update statistics, and refresh examples where needed.",
    },
  },
  {
    id: "seo-check",
    icon: <Globe size={20} />,
    title: "SEO Optimization",
    description: "Improve meta tags and content for search engines",
    category: "maintenance",
    defaults: {
      name: "SEO Check",
      trigger_type: "cron",
      cron_schedule: "0 8 * * 5",
      action_type: "prompt",
      action_prompt:
        "Analyze the website's SEO and make improvements. Update meta descriptions, add alt tags to images, and optimize headings for better search visibility.",
    },
  },
  {
    id: "custom",
    icon: <Zap size={20} />,
    title: "Custom Automation",
    description: "Create your own automation from scratch",
    category: "content",
    defaults: {},
  },
]

// =============================================================================
// SCHEDULE PRESETS - Natural language scheduling
// =============================================================================

type SchedulePreset = {
  id: string
  label: string
  description: string
  cron: string
  icon: React.ReactNode
}

const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "daily-morning",
    label: "Every morning",
    description: "9:00 AM daily",
    cron: "0 9 * * *",
    icon: <Clock size={16} />,
  },
  {
    id: "daily-evening",
    label: "Every evening",
    description: "6:00 PM daily",
    cron: "0 18 * * *",
    icon: <Clock size={16} />,
  },
  {
    id: "weekdays",
    label: "Weekday mornings",
    description: "9:00 AM Mon-Fri",
    cron: "0 9 * * 1-5",
    icon: <Calendar size={16} />,
  },
  {
    id: "weekly-monday",
    label: "Weekly on Monday",
    description: "9:00 AM every Monday",
    cron: "0 9 * * 1",
    icon: <Calendar size={16} />,
  },
  {
    id: "weekly-friday",
    label: "Weekly on Friday",
    description: "5:00 PM every Friday",
    cron: "0 17 * * 5",
    icon: <Calendar size={16} />,
  },
  {
    id: "hourly",
    label: "Every hour",
    description: "On the hour, every hour",
    cron: "0 * * * *",
    icon: <RefreshCw size={16} />,
  },
]

// =============================================================================
// WIZARD STEPS
// =============================================================================

type WizardStep = "template" | "configure" | "schedule" | "review"

function StepIndicator({ currentStep, isEditing }: { currentStep: WizardStep; isEditing: boolean }) {
  const steps = isEditing
    ? [
        { id: "configure" as const, label: "Configure" },
        { id: "schedule" as const, label: "Schedule" },
        { id: "review" as const, label: "Review" },
      ]
    : [
        { id: "template" as const, label: "Choose" },
        { id: "configure" as const, label: "Configure" },
        { id: "schedule" as const, label: "Schedule" },
        { id: "review" as const, label: "Review" },
      ]

  const currentIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all ${
              index <= currentIndex
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40"
            }`}
          >
            {index < currentIndex ? <CheckCircle2 size={14} /> : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-all ${
                index < currentIndex ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// TEMPLATE SELECTION STEP
// =============================================================================

function TemplateStep({ onSelect }: { onSelect: (template: AutomationTemplate) => void }) {
  const categories = [
    { id: "content" as const, label: "Content" },
    { id: "maintenance" as const, label: "Maintenance" },
  ]

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-black dark:text-white mb-1">What do you want to automate?</h3>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">
        Pick a template to get started quickly, or create from scratch
      </p>

      {categories.map(category => {
        const templates = AUTOMATION_TEMPLATES.filter(t => t.category === category.id && t.id !== "custom")
        if (templates.length === 0) return null

        return (
          <div key={category.id} className="mb-6">
            <h4 className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wider mb-3">
              {category.label}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className="group p-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 group-hover:bg-black/10 dark:group-hover:bg-white/20 transition-colors">
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-black dark:text-white text-sm">{template.title}</div>
                      <div className="text-xs text-black/50 dark:text-white/50 mt-0.5 line-clamp-2">
                        {template.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* Custom option */}
      <button
        type="button"
        onClick={() => onSelect(AUTOMATION_TEMPLATES.find(t => t.id === "custom")!)}
        className="w-full p-4 rounded-xl border border-dashed border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40">
            <Plus size={20} />
          </div>
          <div>
            <div className="font-medium text-black/60 dark:text-white/60 text-sm">Start from scratch</div>
            <div className="text-xs text-black/40 dark:text-white/40">
              Create a custom automation with your own settings
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

// =============================================================================
// CONFIGURE STEP
// =============================================================================

function ConfigureStep({
  formData,
  setFormData,
  sites,
  availableSkills,
  onBack,
  onNext,
  isEditing,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  sites: Site[]
  availableSkills: SkillItem[]
  onBack: () => void
  onNext: () => void
  isEditing: boolean
}) {
  const [siteSearch, setSiteSearch] = useState(() => {
    const site = sites.find(s => s.id === formData.site_id)
    return site?.hostname || ""
  })
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false)
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false)

  const filteredSites = sites.filter(s => s.hostname.toLowerCase().includes(siteSearch.toLowerCase()))

  const isValid = formData.site_id && formData.name && formData.action_prompt

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-black dark:text-white mb-1">Configure your automation</h3>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">Set up what this automation will do</p>

      <div className="space-y-5">
        {/* Website Selection */}
        <div className="relative">
          <label className="block text-sm font-medium text-black dark:text-white mb-2">Which website?</label>
          <div className="relative">
            <input
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
              placeholder="Search your websites..."
              className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
            />
            <Globe size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
          </div>
          {siteDropdownOpen && filteredSites.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 max-h-48 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl">
              {filteredSites.slice(0, 8).map(site => (
                <button
                  key={site.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    setFormData(prev => ({ ...prev, site_id: site.id }))
                    setSiteSearch(site.hostname)
                    setSiteDropdownOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 ${
                    formData.site_id === site.id ? "bg-black/5 dark:bg-white/10" : ""
                  }`}
                >
                  <Globe size={16} className="text-black/40 dark:text-white/40" />
                  {site.hostname}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">Give it a name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Daily Blog Post"
            className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
          />
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">What should it do?</label>
          <textarea
            value={formData.action_prompt}
            onChange={e => setFormData(prev => ({ ...prev, action_prompt: e.target.value }))}
            placeholder="Describe what the AI should do. Be specific about the task, the style, and any requirements..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all resize-none"
          />
          <p className="text-xs text-black/40 dark:text-white/40 mt-2">
            Tip: Be specific about what you want. The more detail, the better the results.
          </p>
        </div>

        {/* Skills (collapsed by default) */}
        <div>
          <button
            type="button"
            onClick={() => setSkillsDropdownOpen(!skillsDropdownOpen)}
            className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
          >
            <Book size={16} />
            <span>Add skills for better results</span>
            <span className="text-xs text-black/40 dark:text-white/40">(optional)</span>
          </button>

          {skillsDropdownOpen && (
            <div className="mt-3 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.skills.map(skillId => {
                    const skill = availableSkills.find(s => s.id === skillId)
                    return (
                      <span
                        key={skillId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      >
                        {skill?.displayName || skillId}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skillId) }))
                          }
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {availableSkills
                  .filter(s => !formData.skills.includes(s.id))
                  .slice(0, 6)
                  .map(skill => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, skills: [...prev.skills, skill.id] }))}
                      className="p-3 rounded-lg border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 hover:bg-white dark:hover:bg-white/5 transition-all text-left"
                    >
                      <div className="text-sm font-medium text-black dark:text-white">{skill.displayName}</div>
                      <div className="text-xs text-black/50 dark:text-white/50 line-clamp-1">{skill.description}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/5">
        {!isEditing && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${isEditing ? "ml-auto" : ""} ${
            isValid
              ? "bg-black dark:bg-white text-white dark:text-black hover:opacity-80"
              : "bg-black/10 dark:bg-white/10 text-black/30 dark:text-white/30 cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// SCHEDULE STEP
// =============================================================================

function ScheduleStep({
  formData,
  setFormData,
  onBack,
  onNext,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  onBack: () => void
  onNext: () => void
}) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    const preset = SCHEDULE_PRESETS.find(p => p.cron === formData.cron_schedule)
    return preset?.id || null
  })
  const [showCustom, setShowCustom] = useState(!SCHEDULE_PRESETS.some(p => p.cron === formData.cron_schedule))

  const handlePresetSelect = (preset: SchedulePreset) => {
    setSelectedPreset(preset.id)
    setShowCustom(false)
    setFormData(prev => ({ ...prev, cron_schedule: preset.cron, trigger_type: "cron" }))
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-black dark:text-white mb-1">When should it run?</h3>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">Choose a schedule for your automation</p>

      <div className="space-y-3">
        {SCHEDULE_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePresetSelect(preset)}
            className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
              selectedPreset === preset.id && !showCustom
                ? "border-black dark:border-white bg-black/[0.02] dark:bg-white/[0.02]"
                : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
            }`}
          >
            <div
              className={`p-2 rounded-lg transition-colors ${
                selectedPreset === preset.id && !showCustom
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40"
              }`}
            >
              {preset.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-black dark:text-white">{preset.label}</div>
              <div className="text-sm text-black/50 dark:text-white/50">{preset.description}</div>
            </div>
            {selectedPreset === preset.id && !showCustom && (
              <CheckCircle2 size={20} className="text-black dark:text-white" />
            )}
          </button>
        ))}

        {/* Custom schedule toggle */}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true)
            setSelectedPreset(null)
          }}
          className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
            showCustom
              ? "border-black dark:border-white bg-black/[0.02] dark:bg-white/[0.02]"
              : "border-dashed border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40"
          }`}
        >
          <div
            className={`p-2 rounded-lg transition-colors ${
              showCustom
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40"
            }`}
          >
            <Pencil size={16} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-black/60 dark:text-white/60">Custom schedule</div>
            <div className="text-sm text-black/40 dark:text-white/40">Set a specific cron expression</div>
          </div>
        </button>

        {showCustom && (
          <div className="mt-4 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <label className="block text-sm font-medium text-black dark:text-white mb-2">Cron Expression</label>
            <input
              type="text"
              value={formData.cron_schedule}
              onChange={e => setFormData(prev => ({ ...prev, cron_schedule: e.target.value }))}
              placeholder="0 9 * * *"
              className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
            />
            <p className="text-xs text-black/40 dark:text-white/40 mt-2">
              Format: minute hour day month weekday (e.g., "0 9 * * *" = 9:00 AM daily)
            </p>
          </div>
        )}

        {/* Timezone */}
        <div className="pt-4 border-t border-black/5 dark:border-white/5 mt-6">
          <label className="block text-sm font-medium text-black dark:text-white mb-2">Timezone</label>
          <select
            value={formData.cron_timezone}
            onChange={e => setFormData(prev => ({ ...prev, cron_timezone: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2 rounded-lg text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// REVIEW STEP
// =============================================================================

function ReviewStep({
  formData,
  sites,
  availableSkills,
  onBack,
  onSave,
  saving,
  isEditing,
}: {
  formData: FormData
  sites: Site[]
  availableSkills: SkillItem[]
  onBack: () => void
  onSave: () => void
  saving: boolean
  isEditing: boolean
}) {
  const site = sites.find(s => s.id === formData.site_id)

  // Find matching schedule preset
  const schedulePreset = SCHEDULE_PRESETS.find(p => p.cron === formData.cron_schedule)
  const scheduleLabel = schedulePreset?.label || formData.cron_schedule

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-black dark:text-white mb-1">Review your automation</h3>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">
        Make sure everything looks good before {isEditing ? "saving" : "creating"}
      </p>

      {/* Preview Card */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-black/5 dark:border-white/5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/10">
              <Zap size={24} className="text-black/60 dark:text-white/60" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium text-black dark:text-white">
                {formData.name || "Untitled Automation"}
              </h4>
              <p className="text-sm text-black/50 dark:text-white/50 mt-0.5 flex items-center gap-2">
                <Globe size={14} />
                {site?.hostname || "No website selected"}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          {/* Schedule */}
          <div className="flex items-start gap-3">
            <Calendar size={18} className="text-black/40 dark:text-white/40 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-black dark:text-white">Schedule</div>
              <div className="text-sm text-black/60 dark:text-white/60">
                {scheduleLabel}
                <span className="text-black/40 dark:text-white/40 ml-2">({formData.cron_timezone})</span>
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-black/40 dark:text-white/40 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-black dark:text-white">What it does</div>
              <div className="text-sm text-black/60 dark:text-white/60 mt-1 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                {formData.action_prompt || "No prompt set"}
              </div>
            </div>
          </div>

          {/* Skills */}
          {formData.skills.length > 0 && (
            <div className="flex items-start gap-3">
              <Book size={18} className="text-black/40 dark:text-white/40 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-black dark:text-white">Skills</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {formData.skills.map(skillId => {
                    const skill = availableSkills.find(s => s.id === skillId)
                    return (
                      <span
                        key={skillId}
                        className="px-2.5 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      >
                        {skill?.displayName || skillId}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              {isEditing ? "Saving..." : "Creating..."}
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              {isEditing ? "Save Changes" : "Create Automation"}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN MODAL COMPONENT
// =============================================================================

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
  const [step, setStep] = useState<WizardStep>("template")
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
    skills: [],
    is_active: true,
  })

  // Fetch available skills
  const { data: skillsData } = useQuery<{ skills: SkillItem[] }>({
    queryKey: ["skills", "list"],
    queryFn: async () => {
      const res = await fetch("/api/skills/list")
      if (!res.ok) throw new Error("Failed to fetch skills")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const availableSkills = skillsData?.skills ?? []

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
          skills: editingJob.skills ?? [],
          is_active: editingJob.is_active,
        })
        setStep("configure") // Skip template selection when editing
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
          skills: [],
          is_active: true,
        })
        setStep("template")
      }
    }
  }, [isOpen, editingJob])

  const handleTemplateSelect = (template: AutomationTemplate) => {
    setFormData(prev => ({
      ...prev,
      ...template.defaults,
    }))
    setStep("configure")
  }

  const handleSave = async () => {
    await onSave(formData)
  }

  const isEditing = !!editingJob

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Automation" : "New Automation"} size="md">
      <StepIndicator currentStep={step} isEditing={isEditing} />

      {step === "template" && <TemplateStep onSelect={handleTemplateSelect} />}

      {step === "configure" && (
        <ConfigureStep
          formData={formData}
          setFormData={setFormData}
          sites={sites}
          availableSkills={availableSkills}
          onBack={() => setStep("template")}
          onNext={() => setStep("schedule")}
          isEditing={isEditing}
        />
      )}

      {step === "schedule" && (
        <ScheduleStep
          formData={formData}
          setFormData={setFormData}
          onBack={() => setStep("configure")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          formData={formData}
          sites={sites}
          availableSkills={availableSkills}
          onBack={() => setStep("schedule")}
          onSave={handleSave}
          saving={saving}
          isEditing={isEditing}
        />
      )}
    </Modal>
  )
}

export function AutomationsSettings() {
  const queryClient = useQueryClient()
  const { data: automationsData, isLoading: automationsLoading, error: automationsError } = useAutomationsQuery()
  const { data: sitesData } = useSitesQuery()

  const automations = automationsData?.automations ?? []
  const sites = sitesData?.sites ?? []
  const loading = automationsLoading
  const error = automationsError?.message ?? null

  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<AutomationJob | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [historyJob, setHistoryJob] = useState<AutomationJob | null>(null)

  // Toggle mutation with optimistic update
  const toggleMutation = useMutation<void, ApiError, { id: string; active: boolean }, { previous: unknown }>({
    mutationFn: async ({ id, active }) => {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new ApiError(data.error || "Failed to toggle automation", res.status)
      }
    },
    onMutate: async ({ id, active }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.automations.list() })
      // Snapshot previous value
      const previous = queryClient.getQueryData(queryKeys.automations.list())
      // Optimistic update
      queryClient.setQueryData(queryKeys.automations.list(), (old: { automations: AutomationJob[] } | undefined) => ({
        automations: old?.automations.map(a => (a.id === id ? { ...a, is_active: active } : a)) ?? [],
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.automations.list(), context.previous)
      }
    },
  })

  // Save mutation (create/update)
  const saveMutation = useMutation<void, ApiError, { formData: FormData; editingJobId?: string }>({
    mutationFn: async ({ formData, editingJobId }) => {
      const url = editingJobId ? `/api/automations/${editingJobId}` : "/api/automations"
      const method = editingJobId ? "PATCH" : "POST"

      const body: Record<string, unknown> = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
      }

      if (!editingJobId) {
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

      // Always include skills
      body.skills = formData.skills

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new ApiError(data.error || "Failed to save automation", res.status)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
      setModalOpen(false)
      setEditingJob(null)
    },
    onError: err => {
      alert(err.message || "Failed to save")
    },
  })

  // Delete mutation with optimistic update
  const deleteMutation = useMutation<void, ApiError, string, { previous: unknown }>({
    mutationFn: async id => {
      const res = await fetch(`/api/automations/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        throw new ApiError("Failed to delete automation", res.status)
      }
    },
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: queryKeys.automations.list() })
      const previous = queryClient.getQueryData(queryKeys.automations.list())
      queryClient.setQueryData(queryKeys.automations.list(), (old: { automations: AutomationJob[] } | undefined) => ({
        automations: old?.automations.filter(a => a.id !== id) ?? [],
      }))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.automations.list(), context.previous)
      }
    },
    onSettled: () => {
      setDeleteConfirm(null)
    },
  })

  const handleToggle = useCallback(
    (id: string, active: boolean) => {
      toggleMutation.mutate({ id, active })
    },
    [toggleMutation],
  )

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
      saveMutation.mutate({ formData, editingJobId: editingJob?.id })
    },
    [editingJob, saveMutation],
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

  const handleViewHistory = useCallback((job: AutomationJob) => {
    setHistoryJob(job)
  }, [])

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
          <AutomationCard
            key={job.id}
            job={job}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewHistory={handleViewHistory}
          />
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
        saving={saveMutation.isPending}
      />

      <RunHistoryModal isOpen={!!historyJob} onClose={() => setHistoryJob(null)} job={historyJob} />
    </SettingsTabLayout>
  )
}
