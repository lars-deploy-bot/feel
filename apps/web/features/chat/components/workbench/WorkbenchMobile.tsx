"use client"
import { motion } from "framer-motion"
import { RotateCw, Square, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { PulsingDot } from "../ui/PulsingDot"
import { usePreviewEngine } from "./hooks/usePreviewEngine"

interface WorkbenchMobileProps {
  onClose: () => void
  children?: ReactNode
  busy?: boolean
  statusText?: string
  onStop?: () => void
}

export function WorkbenchMobile({ onClose, children, busy, statusText, onStop }: WorkbenchMobileProps) {
  const { workspace } = useWorkspace({ allowEmpty: true })

  const { setIframeRef, path, isLoading, previewToken, refresh } = usePreviewEngine({ workspace })

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Iframe content */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {workspace && workspace.length > 0 && workspace.includes(".") ? (
          <>
            {/* Loading overlay */}
            {(isLoading || !previewToken) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 alive-logo-outer" />
                    <div className="absolute inset-1.5 rounded-full bg-emerald-400/30 alive-logo-inner" />
                    <div className="absolute inset-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-300">Opening your site</span>
                </div>
              </div>
            )}
            {previewToken && (
              <iframe
                ref={setIframeRef}
                className="w-full h-full border-0"
                title={`Preview: ${workspace}`}
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-700 bg-neutral-900">
            <div className="text-center">
              <div className="mb-2">{workspace ? "Invalid workspace format" : "No workspace selected"}</div>
              <div className="text-xs text-neutral-600">Workspace must be a domain (e.g., example.com)</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar with URL controls and chat input */}
      <div className="bg-neutral-950 border-t border-white/10">
        {/* URL bar row - compact on mobile */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={refresh}
            className="p-2.5 text-neutral-400 hover:text-white active:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RotateCw size={20} strokeWidth={2} />
          </button>
          <span className="flex-1 text-sm text-neutral-500 truncate">{path}</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-neutral-400 hover:text-white active:bg-white/10 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status or chat input area */}
        {busy ? (
          <div className="border-t border-white/5 px-4 py-3 flex items-center gap-2">
            <PulsingDot size="sm" className="flex-shrink-0" />
            <span className="text-sm text-neutral-300 truncate flex-1">{statusText || "Working..."}</span>
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                className="flex-shrink-0 p-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                aria-label="Stop"
              >
                <Square size={14} fill="currentColor" />
              </button>
            )}
          </div>
        ) : (
          children && <div className="border-t border-white/5 dark">{children}</div>
        )}
      </div>
    </motion.div>
  )
}
