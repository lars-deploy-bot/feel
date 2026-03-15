"use client"

import type { AppDatabase } from "@webalive/database"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  trackEmptyStateLaunchTemplate,
  trackEmptyStateOpenGithub,
  trackEmptyStateSelectSite,
} from "@/lib/analytics/events"
import { useOnboardingActions } from "@/lib/stores/onboardingStore"

type Template = Pick<
  AppDatabase["app"]["Tables"]["templates"]["Row"],
  "template_id" | "name" | "description" | "image_url"
>

const DAILY_PROMPTS = [
  "What's next?",
  "Ready to build?",
  "Let's ship something.",
  "What are we making?",
  "Time to create.",
  "Got an idea?",
  "Let's go.",
]

function getDailyPrompt(): string {
  const daysSinceEpoch = Math.floor(Date.now() / 86_400_000)
  return DAILY_PROMPTS[daysSinceEpoch % DAILY_PROMPTS.length]
}

interface ChatEmptyStateProps {
  workspace: string | null
  totalDomainCount: number
  isLoading?: boolean
  onImportGithub?: () => void
  onSelectSite?: () => void
}

export function ChatEmptyState({
  workspace,
  totalDomainCount,
  isLoading,
  onImportGithub,
  onSelectSite,
}: ChatEmptyStateProps) {
  const dailyPrompt = useMemo(getDailyPrompt, [])

  // Show nothing while loading organizations - prevents flash of "no sites" message
  if (isLoading && !workspace) {
    return null
  }

  return (
    <div className="flex items-center justify-center h-full">
      {workspace ? (
        <p className="text-lg text-black/80 dark:text-white/80 font-medium">{dailyPrompt}</p>
      ) : totalDomainCount === 0 ? (
        <NewUserWelcome onImportGithub={onImportGithub} />
      ) : (
        <ReturningUserPicker onImportGithub={onImportGithub} onSelectSite={onSelectSite} />
      )}
    </div>
  )
}

/** Brand new user — show templates visually */
function NewUserWelcome({ onImportGithub }: { onImportGithub?: () => void }) {
  const router = useRouter()
  const { setTemplateId } = useOnboardingActions()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/templates")
        const data = await res.json()
        if (!cancelled && data.templates) {
          setTemplates(data.templates)
        }
      } catch {
        // Silently fail — buttons below still work
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function handleTemplateClick(templateId: string) {
    trackEmptyStateLaunchTemplate()
    setTemplateId(templateId)
    router.push(`/deploy/start?template=${encodeURIComponent(templateId)}`)
  }

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8 px-4">
      <p className="text-2xl font-semibold text-black dark:text-white tracking-tight">Build something.</p>

      {/* Template grid */}
      {loading ? null : templates.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates.map(template => (
            <button
              key={template.template_id}
              type="button"
              onClick={() => handleTemplateClick(template.template_id)}
              className="group text-left rounded-xl overflow-hidden bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.04] hover:border-black/[0.08] dark:hover:border-white/[0.08] transition-all duration-200 active:scale-[0.98]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-black/[0.03] dark:bg-white/[0.03]">
                {template.image_url ? (
                  <img
                    src={template.image_url}
                    alt={template.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-medium text-black/80 dark:text-white/80">{template.name}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Secondary actions */}
      <div className="flex items-center justify-center gap-3">
        {onImportGithub && (
          <button
            type="button"
            onClick={() => {
              trackEmptyStateOpenGithub()
              onImportGithub()
            }}
            className="text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
          >
            Import from GitHub
          </button>
        )}
      </div>
    </div>
  )
}

/** Returning user with sites — nudge to pick one */
function ReturningUserPicker({
  onImportGithub,
  onSelectSite,
}: {
  onImportGithub?: () => void
  onSelectSite?: () => void
}) {
  return (
    <div className="max-w-md text-center space-y-6">
      <p className="text-lg text-black/80 dark:text-white/80 font-medium">Welcome back.</p>
      <div className="pt-2 flex items-center justify-center gap-3">
        {onSelectSite && (
          <button
            type="button"
            onClick={() => {
              trackEmptyStateSelectSite()
              onSelectSite()
            }}
            className="h-9 px-5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors duration-100"
          >
            Open a project
          </button>
        )}
        {onImportGithub && (
          <button
            type="button"
            onClick={() => {
              trackEmptyStateOpenGithub()
              onImportGithub()
            }}
            className="h-9 px-5 rounded-lg text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
          >
            Import from GitHub
          </button>
        )}
      </div>
    </div>
  )
}
