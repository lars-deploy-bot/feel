"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type AgentFieldErrors,
  CLAUDE_MODELS,
  type ClaudeModel,
  isValidClaudeModel,
  validateAgentCreate,
  validateAgentField,
} from "@webalive/shared"
import { Check, ChevronDown, Loader2, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { AutomationConfigData, AutomationConfigResult } from "@/components/ai/AutomationConfig"
import type { SkillItem } from "@/components/automations/types"
import { ApiError, postty } from "@/lib/api/api-client"
import { buildCreatePayload, configResultToFormData } from "@/lib/automation/build-payload"
import { MODEL_OPTIONS } from "@/lib/automation/form-options"
import { ErrorAlert, INPUT, TrigIcon } from "./AgentUI"
import { agentAvatar } from "./agent-avatars"
import { agentsApi } from "./agents-api"
import {
  AUTO_SAVE_DEBOUNCE,
  DEFAULT_SCHEDULE,
  DEFAULT_SCHEDULE_TIME,
  minutesToSeconds,
  minutesToSecondsOrNull,
  SAVED_BADGE_DURATION,
  timeoutMinutes,
  trigLabel,
} from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

interface AgentEditViewProps {
  job: EnrichedJob | null
  createData?: AutomationConfigData | null
  onDone: (message?: string) => void
  onChanged?: () => void
}

/** Build the changed-fields object for an edit update */
function buildEditFields(
  job: EnrichedJob,
  state: { name: string; prompt: string; model: string; schedule: string; timeoutMin: string; skills: string[] },
  orig: { model: string; schedule: string; timeoutMin: string },
): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (state.name !== job.name) fields.name = state.name
  if (state.prompt !== (job.action_prompt ?? "")) fields.action_prompt = state.prompt || null
  if (state.model !== orig.model) fields.action_model = state.model || null
  if (state.schedule !== orig.schedule) fields.schedule_text = state.schedule || null
  if (state.timeoutMin !== orig.timeoutMin) fields.action_timeout_seconds = minutesToSecondsOrNull(state.timeoutMin)
  const origSkills = job.skills ?? []
  if (JSON.stringify(state.skills) !== JSON.stringify(origSkills)) fields.skills = state.skills
  return fields
}

/** Validate changed fields for an edit update */
function validateEditFields(
  job: EnrichedJob,
  state: { name: string; prompt: string; timeoutMin: string },
  origTimeoutMin: string,
): AgentFieldErrors | null {
  const errors: AgentFieldErrors = {}
  if (state.name !== job.name) {
    const e = validateAgentField("name", state.name)
    if (e) errors.name = e
  }
  if (state.prompt !== (job.action_prompt ?? "")) {
    const e = validateAgentField("prompt", state.prompt)
    if (e) errors.prompt = e
  }
  if (state.timeoutMin !== origTimeoutMin) {
    const e = validateAgentField("timeout", minutesToSeconds(state.timeoutMin))
    if (e) errors.timeout = e
  }
  return Object.keys(errors).length > 0 ? errors : null
}

export function AgentEditView({ job, createData, onDone, onChanged }: AgentEditViewProps) {
  const isCreate = !job

  const [name, setName] = useState(job?.name ?? createData?.defaultName ?? "")
  const [model, setModel] = useState<ClaudeModel | "">(
    job && isValidClaudeModel(job.action_model)
      ? job.action_model
      : (createData?.defaultModel ?? CLAUDE_MODELS.HAIKU_4_5),
  )
  const [schedule, setSchedule] = useState(job ? trigLabel(job) : DEFAULT_SCHEDULE)
  const [timeoutMin, setTimeoutMin] = useState(String(timeoutMinutes(job?.action_timeout_seconds)))
  const [skills, setSkills] = useState<string[]>(job?.skills ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<AgentFieldErrors>({})

  const promptRef = useRef<HTMLDivElement>(null)
  const charCountRef = useRef<HTMLSpanElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  /** Last failed save payload — prevents retrying the exact same failing fields until user changes something */
  const lastFailedPayloadRef = useRef<{ fingerprint: string; jobId: string } | null>(null)

  /** Read prompt from DOM — single source of truth */
  const getPrompt = useCallback(() => promptRef.current?.textContent ?? "", [])

  const { data: skillsData } = useQuery<{ skills: SkillItem[] }>({
    queryKey: ["skills", "list"],
    queryFn: async () => {
      const res = await fetch("/api/skills/list", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch skills")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const availableSkills = skillsData?.skills ?? []

  // Re-sync when job changes
  useEffect(() => {
    if (job) {
      setName(job.name)
      setModel(isValidClaudeModel(job.action_model) ? job.action_model : "")
      setSchedule(trigLabel(job))
      setTimeoutMin(String(timeoutMinutes(job.action_timeout_seconds)))
      setSkills(job.skills ?? [])
    }
    setError(null)
    setFieldErrors({})
  }, [job?.id])

  // Sync contentEditable + char count on mount and when job changes
  useEffect(() => {
    if (promptRef.current) {
      const target = job?.action_prompt ?? createData?.defaultPrompt ?? ""
      if ((promptRef.current.textContent ?? "") !== target) {
        promptRef.current.textContent = target
      }
      if (charCountRef.current) {
        charCountRef.current.textContent = `${target.length.toLocaleString()} chars`
      }
    }
  }, [job?.id, createData?.defaultPrompt])

  // ── Derived values ──
  const origModel = job && isValidClaudeModel(job.action_model) ? job.action_model : ""
  const origTimeoutMin = String(timeoutMinutes(job?.action_timeout_seconds))
  const origSchedule = job ? trigLabel(job) : ""

  // ── Create handler (explicit submit) ──
  const handleCreate = useCallback(async () => {
    const prompt = getPrompt()
    const errors = validateAgentCreate({
      name,
      prompt,
      schedule,
      timeout: minutesToSeconds(timeoutMin),
    })
    if (errors) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSaving(true)
    setError(null)
    try {
      const site = createData?.sites?.[0]
      if (!site) throw new Error("No site available")

      const result: AutomationConfigResult = {
        siteId: site.id,
        siteName: site.hostname,
        name,
        prompt,
        model: (model || CLAUDE_MODELS.HAIKU_4_5) as ClaudeModel,
        scheduleType: "custom",
        scheduleText: schedule,
        scheduleTime: DEFAULT_SCHEDULE_TIME,
      }
      const request = buildCreatePayload(configResultToFormData(result))
      await postty("automations/create", request)
      onDone(`Agent "${name}" created. Schedule: ${schedule}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to create")
    } finally {
      setSaving(false)
    }
  }, [createData, getPrompt, name, model, schedule, timeoutMin, onDone])

  // ── Auto-save (called from native input listener, not React state) ──
  const doAutoSave = useCallback(async () => {
    if (isCreate || !job) return
    const prompt = getPrompt()
    const state = { name, prompt, model, schedule, timeoutMin, skills }
    const orig = { model: origModel, schedule: origSchedule, timeoutMin: origTimeoutMin }

    const origSkills = job.skills ?? []
    const hasChanges =
      name !== job.name ||
      prompt !== (job.action_prompt ?? "") ||
      model !== origModel ||
      schedule !== origSchedule ||
      timeoutMin !== origTimeoutMin ||
      JSON.stringify(skills) !== JSON.stringify(origSkills)
    if (!hasChanges) return

    const errors = validateEditFields(job, state, origTimeoutMin)
    if (errors) {
      setFieldErrors(errors)
      return
    }

    const fields = buildEditFields(job, state, orig)
    if (Object.keys(fields).length === 0) return

    // Dedup: don't retry the exact same payload that just failed for the same job
    const fingerprint = JSON.stringify(fields)
    const lastFailed = lastFailedPayloadRef.current
    if (lastFailed && lastFailed.fingerprint === fingerprint && lastFailed.jobId === job.id) return

    setFieldErrors({})
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await agentsApi.update(job.id, fields)
      lastFailedPayloadRef.current = null
      onChanged?.()
      setSaved(true)
      globalThis.setTimeout(() => setSaved(false), SAVED_BADGE_DURATION)
    } catch (e) {
      lastFailedPayloadRef.current = { fingerprint, jobId: job.id }
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [
    isCreate,
    job,
    getPrompt,
    name,
    model,
    schedule,
    timeoutMin,
    skills,
    origModel,
    origSchedule,
    origTimeoutMin,
    onChanged,
  ])

  // Stable ref so the native listener always calls the latest version
  const doAutoSaveRef = useRef(doAutoSave)
  doAutoSaveRef.current = doAutoSave

  /** Schedule a debounced auto-save */
  const scheduleSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = globalThis.setTimeout(() => doAutoSaveRef.current(), AUTO_SAVE_DEBOUNCE)
  }, [])

  // Native input listener on the contentEditable — no React state, no re-renders
  useEffect(() => {
    const el = promptRef.current
    if (!el) return

    function handleInput() {
      // Update char count directly in the DOM
      if (charCountRef.current) {
        const len = el!.textContent?.length ?? 0
        charCountRef.current.textContent = `${len.toLocaleString()} chars`
      }
      scheduleSave()
    }

    el.addEventListener("input", handleInput)
    return () => el.removeEventListener("input", handleInput)
  }, [scheduleSave])

  // Debounce auto-save for non-prompt fields (name, model, schedule, timeout)
  useEffect(() => {
    if (isCreate) return
    scheduleSave()
  }, [isCreate, name, model, schedule, timeoutMin, skills, scheduleSave])

  const triggerType = job?.trigger_type ?? "cron"

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* Left column — settings */}
        <div className="w-[300px] shrink-0 border-r border-zinc-100 dark:border-white/[0.04] overflow-auto px-5 py-5">
          <AvatarEditor
            jobId={job?.id ?? name}
            savedAvatarUrl={job?.avatar_url ?? createData?.defaultAvatarUrl ?? null}
            onAvatarSaved={onChanged}
          />

          <FieldGroup label="Agent's name" color="emerald">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Agent name"
              className={`${INPUT} ${fieldErrors.name ? "border-red-300 dark:border-red-700" : ""}`}
            />
            {fieldErrors.name && <p className="text-[11px] text-red-500 mt-1.5">{fieldErrors.name}</p>}
          </FieldGroup>

          <FieldGroup label="Schedule" color="blue" icon={<TrigIcon type={triggerType} size={13} />}>
            {triggerType === "cron" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                  placeholder={DEFAULT_SCHEDULE}
                  className={INPUT}
                />
                <div>
                  <label
                    htmlFor="edit-timeout"
                    className="text-[12px] font-medium text-zinc-400 dark:text-zinc-600 block mb-2"
                  >
                    Timeout: <span className="font-bold text-zinc-900 dark:text-zinc-100">{timeoutMin} min</span>
                  </label>
                  <input
                    id="edit-timeout"
                    type="range"
                    min={1}
                    max={60}
                    value={timeoutMin}
                    onChange={e => setTimeoutMin(e.target.value)}
                    className="w-full h-2 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-300 dark:text-zinc-700 mt-1 tabular-nums">
                    <span>1m</span>
                    <span>60m</span>
                  </div>
                </div>
              </div>
            )}
            {triggerType === "email" && job?.email_address && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-mono">{job.email_address}</p>
            )}
            {triggerType === "webhook" && <p className="text-[12px] text-zinc-400">Triggered via webhook.</p>}
            {triggerType === "one-time" && <p className="text-[12px] text-zinc-400">Runs once.</p>}
          </FieldGroup>

          <FieldGroup label="Model" color="violet">
            <div className="flex flex-wrap gap-2">
              {MODEL_OPTIONS.map(opt => {
                const selected = model === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setModel(selected ? "" : (opt.value as ClaudeModel))}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all border-b-[3px] active:translate-y-[2px] active:border-b-0 ${
                      selected
                        ? "bg-violet-500 dark:bg-violet-600 text-white border-violet-600 dark:border-violet-700"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:brightness-95 dark:hover:brightness-110"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </FieldGroup>

          <FieldGroup label="Skills" color="blue">
            <SkillsPicker skills={skills} available={availableSkills} onChange={setSkills} />
          </FieldGroup>

          {error && <ErrorAlert message={error} />}
        </div>

        {/* Right column — prompt */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="shrink-0 px-5 h-11 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.04]">
            <span className="text-[12px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Instructions
            </span>
            <span ref={charCountRef} className="text-[11px] font-medium text-zinc-300 dark:text-zinc-700 tabular-nums">
              0 chars
            </span>
          </div>
          {fieldErrors.prompt && (
            <div className="px-5 pt-2">
              <p className="text-[11px] text-red-500">{fieldErrors.prompt}</p>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto">
            <div
              ref={promptRef}
              contentEditable
              suppressContentEditableWarning
              className="px-5 py-4 text-[15px] text-zinc-900 dark:text-zinc-100 leading-[1.7] outline-none min-h-full whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-300 dark:empty:before:text-zinc-700"
              data-placeholder="Describe what this agent should do..."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 py-3 px-5 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px]">
          {saving && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Loader2 size={12} className="animate-spin" />
              Saving...
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <Check size={12} />
              Saved
            </span>
          )}
          {error && !saving && <span className="text-red-500">{error}</span>}
        </div>
        <div className="flex items-center gap-3">
          {isCreate ? (
            <>
              <button
                type="button"
                onClick={() => onDone()}
                className="h-9 px-5 rounded-xl text-[13px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="h-9 px-5 rounded-xl text-[13px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 border-b-[3px] border-emerald-600 active:translate-y-[2px] active:border-b-0 disabled:opacity-40 transition-all"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Create"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onDone()}
              className="h-9 px-5 rounded-xl text-[13px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldGroup({
  label,
  icon,
  color,
  children,
}: {
  label: string
  icon?: React.ReactNode
  color: "emerald" | "blue" | "violet"
  children: React.ReactNode
}) {
  const colors = {
    emerald: "text-emerald-500 dark:text-emerald-400",
    blue: "text-blue-500 dark:text-blue-400",
    violet: "text-violet-500 dark:text-violet-400",
  }
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-2 ${colors[color]}`}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  )
}

function SkillsPicker({
  skills,
  available,
  onChange,
}: {
  skills: string[]
  available: SkillItem[]
  onChange: (skills: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-[13px] transition-all ${
          open
            ? "border-blue-300 dark:border-blue-500/30 ring-2 ring-blue-500/20"
            : "border-zinc-200 dark:border-zinc-700"
        } bg-transparent text-zinc-500 dark:text-zinc-400`}
      >
        <span>{skills.length > 0 ? `${skills.length} selected` : "None"}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown list */}
      {open && available.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {available.map(skill => {
            const selected = skills.includes(skill.id)
            return (
              <button
                type="button"
                key={skill.id}
                onClick={() =>
                  onChange(skills.includes(skill.id) ? skills.filter(s => s !== skill.id) : [...skills, skill.id])
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <div
                  className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    selected ? "bg-blue-500 border-blue-500" : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-900 dark:text-zinc-100">{skill.displayName}</span>
                  {skill.description && (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 truncate">{skill.description}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Selected chips */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map(id => {
            const label = available.find(s => s.id === id)?.displayName ?? id
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              >
                {label}
                <button
                  type="button"
                  onClick={() => onChange(skills.filter(s => s !== id))}
                  className="hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AvatarEditor({
  jobId,
  savedAvatarUrl,
  onAvatarSaved,
}: {
  jobId: string | null
  savedAvatarUrl: string | null
  onAvatarSaved?: () => void
}) {
  const [description, setDescription] = useState("")
  const [gender, setGender] = useState<"man" | "woman">("man")
  const [generating, setGenerating] = useState(false)
  const [customUrl, setCustomUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const src = customUrl ?? savedAvatarUrl ?? agentAvatar(jobId ?? "new-agent")

  const generate = async () => {
    if (!description.trim() || generating) return
    setGenerating(true)
    setError(null)
    try {
      const fullDescription = `${gender}. ${description.trim()}`
      const res = await fetch("/api/agents/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: fullDescription }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.message === "string" ? data.message : (data.error ?? "Generation failed")
        setError(msg.includes("Too many") ? "Rate limited — try again in a few minutes" : msg)
        return
      }
      if (data.file_url) {
        setCustomUrl(data.file_url)
        setDescription("")
        // Save avatar_url to the job in DB, then refresh parent
        if (jobId) {
          await agentsApi.update(jobId, { avatar_url: data.file_url })
          onAvatarSaved?.()
        }
      } else {
        setError("Generation returned no image")
      }
    } catch (_err) {
      setError("Could not reach the server")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mb-6 flex flex-col items-center">
      <img src={src} alt="" className="w-36 h-48 object-cover object-top rounded-lg mb-4" />
      <div className="flex gap-1 mb-2">
        {(["man", "woman"] as const).map(g => (
          <button
            key={g}
            type="button"
            onClick={() => setGender(g)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
              gender === g
                ? "bg-violet-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:brightness-95 dark:hover:brightness-110"
            }`}
          >
            {g === "man" ? "Man" : "Woman"}
          </button>
        ))}
      </div>
      <div className="w-full flex gap-2">
        <input
          type="text"
          value={description}
          onChange={e => {
            setDescription(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={e => {
            if (e.key === "Enter") generate()
          }}
          placeholder="e.g. SEO specialist, email writer..."
          className={`flex-1 min-w-0 px-3 py-1.5 rounded-xl border bg-transparent text-[12px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none transition-colors ${
            error
              ? "border-red-300 dark:border-red-700"
              : "border-zinc-200 dark:border-zinc-700 focus:border-violet-300 dark:focus:border-violet-500/30"
          }`}
        />
        <button
          type="button"
          onClick={generate}
          disabled={generating || !description.trim()}
          className="shrink-0 size-8 flex items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/15 disabled:opacity-40 transition-all"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1.5 text-center">{error}</p>}
      {generating && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 text-center">Generating avatar...</p>
      )}
    </div>
  )
}
