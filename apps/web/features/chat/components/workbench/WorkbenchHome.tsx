"use client"

import { ExternalLink } from "lucide-react"
import type { WorkbenchView } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { getSiteUrl } from "@/lib/preview-utils"

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-white/[0.04] last:border-0">
      <span className="text-[13px] text-zinc-500 dark:text-zinc-500">{label}</span>
      <span className="text-[13px] text-zinc-900 dark:text-zinc-100">{children}</span>
    </div>
  )
}

export function WorkbenchHome({ onSelectView: _ }: { onSelectView: (view: WorkbenchView) => void }) {
  const { workspace } = useWorkspace({ allowEmpty: true })
  const siteUrl = workspace ? getSiteUrl(workspace) : null

  return (
    <div className="h-full overflow-auto">
      <div className="px-5 py-5">
        <h2 className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
          Project
        </h2>

        <div className="mt-3">
          <SettingsRow label="Domain">
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
              <span className="text-zinc-400 dark:text-zinc-600">—</span>
            )}
          </SettingsRow>
        </div>
      </div>
    </div>
  )
}
