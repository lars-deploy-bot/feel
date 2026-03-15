"use client"

import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react"
import { useCallback, useRef } from "react"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { getSiteUrl } from "@/lib/preview-utils"
import { PulsingDot } from "../ui/PulsingDot"
import { usePreviewEngine } from "./hooks/usePreviewEngine"
import { useViewState } from "./hooks/useViewState"

const DEVICE_WIDTHS = {
  desktop: "100%",
  mobile: "375px",
} as const

export function SitePreviewView({ workspace }: WorkbenchViewProps) {
  const device = useViewState("site", { device: "desktop" })
  const inputRef = useRef<HTMLInputElement>(null)

  const handleNavigate = useCallback((newPath: string) => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = newPath
    }
  }, [])

  const { setIframeRef, path, isLoading, previewToken, refresh, navigateTo } = usePreviewEngine({
    workspace,
    onNavigate: handleNavigate,
  })

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputRef.current) {
      const inputValue = inputRef.current.value.trim()

      const lowerInput = inputValue.toLowerCase()
      if (lowerInput.startsWith("http://") || lowerInput.startsWith("https://")) {
        window.open(inputValue, "_blank", "noopener,noreferrer")
        inputRef.current.value = path
        return
      }

      let newPath = inputValue
      if (!newPath.startsWith("/")) newPath = `/${newPath}`
      inputRef.current.value = newPath
      navigateTo(newPath)
    }
  }

  const previewDevice = device.value.device
  const isMobile = previewDevice === "mobile"

  return (
    <div className="flex flex-col h-full">
      {/* Context bar — device toggle + URL bar */}
      <div className="h-10 px-2.5 flex items-center justify-center gap-2 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0">
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => device.set({ device: "desktop" })}
            className={`p-1 rounded transition-colors ${
              previewDevice === "desktop"
                ? "text-black/60 dark:text-white/60"
                : "text-black/20 dark:text-white/15 hover:text-black/40 dark:hover:text-white/30"
            }`}
            title="Desktop"
          >
            <Monitor size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => device.set({ device: "mobile" })}
            className={`p-1 rounded transition-colors ${
              previewDevice === "mobile"
                ? "text-black/60 dark:text-white/60"
                : "text-black/20 dark:text-white/15 hover:text-black/40 dark:hover:text-white/30"
            }`}
            title="Mobile"
          >
            <Smartphone size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="h-7 flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg px-2.5 min-w-0 max-w-[320px] w-full">
          <button
            type="button"
            onClick={refresh}
            className="p-0.5 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
            title="Refresh"
          >
            <RotateCw size={13} strokeWidth={1.5} />
          </button>
          <input
            ref={inputRef}
            type="text"
            defaultValue={path}
            onKeyDown={handlePathSubmit}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-neutral-600 dark:text-neutral-400 outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
            placeholder="/"
          />
        </div>
        <a
          href={getSiteUrl(workspace, path)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
          title="Open in new tab"
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </a>
      </div>

      {/* Preview viewport */}
      <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-[#111] relative flex items-start justify-center">
        {(isLoading || !previewToken) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0d0d0d]">
            <PulsingDot size="lg" />
          </div>
        )}
        <div
          className={`h-full bg-white dark:bg-[#0d0d0d] transition-[width,box-shadow] duration-300 ease-out overflow-hidden ${
            isMobile ? "rounded-xl mt-3 mb-3 shadow-lg border border-black/[0.08] dark:border-white/[0.06]" : ""
          }`}
          style={{
            width: DEVICE_WIDTHS[previewDevice],
            maxHeight: isMobile ? "calc(100% - 24px)" : "100%",
          }}
        >
          {previewToken && (
            <iframe
              ref={setIframeRef}
              className="w-full h-full border-0"
              title={`Preview: ${workspace}`}
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
      </div>
    </div>
  )
}
