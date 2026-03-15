"use client"

import { ExternalLink, Loader2 } from "lucide-react"
import { useCallback, useState } from "react"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { getSiteUrl } from "@/lib/preview-utils"
import { usePublish } from "./hooks/usePublish"

// ── Types ────────────────────────────────────────────────────────────────────

type InfoTab = "project" | "deploy"

const TABS: { id: InfoTab; label: string; description: string }[] = [
  { id: "project", label: "Project", description: "Your site and its current state" },
  { id: "deploy", label: "Deploy", description: "Push changes to your live site" },
]

type DeployStep = "url" | "access" | "info" | "review"

type AccessLevel = "public" | "private"

interface DeployConfig {
  customDomain: string
  access: AccessLevel
  title: string
  description: string
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-100 dark:border-white/[0.04] last:border-0">
      <span className="text-[13px] text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-[13px] text-zinc-900 dark:text-zinc-100">{children}</span>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-1">{description}</p>
    </div>
  )
}

// ── Step nav ─────────────────────────────────────────────────────────────────

const STEP_ORDER: DeployStep[] = ["url", "access", "info", "review"]
const STEP_LABELS: Record<DeployStep, string> = { url: "URL", access: "Access", info: "Info", review: "Review" }

function StepNav({ current }: { current: DeployStep }) {
  const currentIdx = STEP_ORDER.indexOf(current)
  return (
    <div className="flex items-center gap-5 mb-8">
      {STEP_ORDER.map((step, i) => (
        <span
          key={step}
          className={`text-[13px] ${
            i === currentIdx
              ? "font-medium text-zinc-900 dark:text-zinc-100"
              : i < currentIdx
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-zinc-300 dark:text-zinc-700"
          }`}
        >
          {STEP_LABELS[step]}
        </span>
      ))}
    </div>
  )
}

function WizardFooter({
  step,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  step: DeployStep
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2 mt-10">
      {step !== "url" && (
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-lg text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="h-9 px-5 rounded-lg text-[13px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors duration-100 disabled:opacity-40"
      >
        {nextLabel ?? "Continue"}
      </button>
    </div>
  )
}

// ── Deploy Steps ─────────────────────────────────────────────────────────────

function UrlStep({
  workspace,
  config,
  onChange,
}: {
  workspace: string
  config: DeployConfig
  onChange: (c: Partial<DeployConfig>) => void
}) {
  const slug = workspace.split(".")[0]
  const suffix = workspace.slice(slug.length)

  return (
    <div>
      <SectionHeader title="Website address" description="Your site's URL. You can add a custom domain later." />

      <div className="flex items-center h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <span className="h-full flex items-center px-3 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
          {slug}
        </span>
        <span className="h-full flex items-center px-3 text-[13px] text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-800">
          {suffix}
        </span>
      </div>

      {!config.customDomain ? (
        <button
          type="button"
          onClick={() => onChange({ customDomain: " " })}
          className="mt-4 text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
        >
          + Custom domain
        </button>
      ) : (
        <div className="mt-5">
          <label className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 mb-1.5 block">Custom domain</label>
          <input
            type="text"
            value={config.customDomain.trim()}
            onChange={e => onChange({ customDomain: e.target.value })}
            placeholder="yourdomain.com"
            className="w-full h-10 px-3 rounded-lg text-[13px] border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all duration-100"
          />
        </div>
      )}
    </div>
  )
}

function AccessStep({ config, onChange }: { config: DeployConfig; onChange: (c: Partial<DeployConfig>) => void }) {
  const options: { id: AccessLevel; label: string; hint: string }[] = [
    { id: "public", label: "Public", hint: "Anyone with the link" },
    { id: "private", label: "Private", hint: "Only you" },
  ]

  return (
    <div>
      <SectionHeader title="Who can access" description="Choose who can view your published site." />

      <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
        {options.map(({ id, label, hint }) => {
          const selected = config.access === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ access: id })}
              className="w-full text-left flex items-center justify-between py-3.5 transition-colors duration-100 group"
            >
              <div>
                <span
                  className={`text-[13px] ${
                    selected
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                  }`}
                >
                  {label}
                </span>
                <span className="text-[13px] text-zinc-400 dark:text-zinc-600 ml-2">{hint}</span>
              </div>
              <div
                className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors duration-100 ${
                  selected ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {selected && <div className="size-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function InfoStep({ config, onChange }: { config: DeployConfig; onChange: (c: Partial<DeployConfig>) => void }) {
  return (
    <div>
      <SectionHeader title="Website info" description="Search engines and social sharing. Optional." />

      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Title</label>
            <span className="text-[11px] text-zinc-300 dark:text-zinc-700 tabular-nums">{config.title.length}/60</span>
          </div>
          <input
            type="text"
            value={config.title}
            onChange={e => {
              if (e.target.value.length <= 60) onChange({ title: e.target.value })
            }}
            placeholder="My Website"
            className="w-full h-10 px-3 rounded-lg text-[13px] border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all duration-100"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Description</label>
            <span className="text-[11px] text-zinc-300 dark:text-zinc-700 tabular-nums">
              {config.description.length}/160
            </span>
          </div>
          <textarea
            value={config.description}
            onChange={e => {
              if (e.target.value.length <= 160) onChange({ description: e.target.value })
            }}
            placeholder="A short description of your site"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-[13px] border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all duration-100 resize-none"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 mb-1.5 block">Social image</label>
          <button
            type="button"
            className="w-full h-20 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-[12px] text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-500 transition-colors duration-100"
          >
            Upload 1200 x 630
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({
  workspace,
  config,
  publishState,
  publishMessage,
  onPublish,
  onBack,
}: {
  workspace: string
  config: DeployConfig
  publishState: string
  publishMessage: string
  onPublish: () => void
  onBack: () => void
}) {
  return (
    <div>
      <SectionHeader title="Review" description="Confirm your settings." />

      <div>
        <Row label="URL">{workspace}</Row>
        <Row label="Access">{config.access === "public" ? "Anyone with the link" : "Only you"}</Row>
        <Row label="Title">{config.title || <span className="text-zinc-300 dark:text-zinc-700">—</span>}</Row>
        <Row label="Description">
          {config.description || <span className="text-zinc-300 dark:text-zinc-700">—</span>}
        </Row>
      </div>

      <div className="flex items-center gap-2 mt-10">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-lg text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishState === "building"}
          className={`h-9 px-6 rounded-lg text-[13px] font-medium transition-all duration-100 ${
            publishState === "building"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 opacity-40"
              : publishState === "error"
                ? "bg-red-500 text-white"
                : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
          }`}
        >
          {publishState === "building" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Publishing...
            </span>
          ) : publishState === "done" ? (
            publishMessage
          ) : publishState === "error" ? (
            publishMessage
          ) : (
            "Publish"
          )}
        </button>
      </div>
    </div>
  )
}

// ── Deploy Panel (wizard) ────────────────────────────────────────────────────

function DeployPanel({ workspace }: { workspace: string }) {
  const { state: publishState, message: publishMessage, publish } = usePublish()
  const [step, setStep] = useState<DeployStep>("url")
  const [config, setConfig] = useState<DeployConfig>({
    customDomain: "",
    access: "public",
    title: "",
    description: "",
  })

  const updateConfig = useCallback((partial: Partial<DeployConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }, [])

  const currentIdx = STEP_ORDER.indexOf(step)
  const goNext = () => {
    if (currentIdx < STEP_ORDER.length - 1) setStep(STEP_ORDER[currentIdx + 1])
  }
  const goBack = () => {
    if (currentIdx > 0) setStep(STEP_ORDER[currentIdx - 1])
  }

  return (
    <div>
      <StepNav current={step} />

      {step === "url" && <UrlStep workspace={workspace} config={config} onChange={updateConfig} />}
      {step === "access" && <AccessStep config={config} onChange={updateConfig} />}
      {step === "info" && <InfoStep config={config} onChange={updateConfig} />}
      {step === "review" && (
        <ReviewStep
          workspace={workspace}
          config={config}
          publishState={publishState}
          publishMessage={publishMessage}
          onPublish={publish}
          onBack={goBack}
        />
      )}

      {step !== "review" && <WizardFooter step={step} onBack={goBack} onNext={goNext} />}
    </div>
  )
}

// ── Project Panel ────────────────────────────────────────────────────────────

function ProjectPanel({ workspace }: { workspace: string }) {
  const siteUrl = getSiteUrl(workspace)

  return (
    <div>
      <SectionHeader title="Project" description="Your site and its current state." />
      <Row label="Domain">
        {siteUrl ? (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 transition-colors duration-100"
          >
            {workspace}
            <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-700">—</span>
        )}
      </Row>
      <Row label="Status">
        <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span className="size-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
          Live
        </span>
      </Row>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function WorkbenchHome({ workspace }: WorkbenchViewProps) {
  const [activeTab, setActiveTab] = useState<InfoTab>("project")

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="w-[200px] flex-shrink-0 border-r border-zinc-100 dark:border-white/[0.06] p-2">
        <div className="space-y-0.5">
          {TABS.map(({ id, label, description }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100 ${
                  active ? "bg-black/[0.04] dark:bg-white/[0.04]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                }`}
              >
                <span
                  className={`block text-[13px] ${
                    active ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-500"
                  }`}
                >
                  {label}
                </span>
                <span className="block text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-md">
          {activeTab === "project" && workspace && <ProjectPanel workspace={workspace} />}
          {activeTab === "deploy" && workspace && <DeployPanel workspace={workspace} />}
        </div>
      </div>
    </div>
  )
}
