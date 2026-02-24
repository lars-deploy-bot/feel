"use client"

import { ArrowLeft, Eye, Pencil } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface PromptEditorModalProps {
  mode: "add" | "edit"
  initialDisplayName?: string
  initialData?: string
  onSave: (displayName: string, data: string) => void
  onCancel: () => void
}

export function PromptEditorModal({
  mode,
  initialDisplayName = "",
  initialData = "",
  onSave,
  onCancel,
}: PromptEditorModalProps) {
  const titleId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevViewRef = useRef<"edit" | "preview">("edit")
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [data, setData] = useState(initialData)
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<"edit" | "preview">("edit")

  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => setMounted(false)
  }, [])

  // When switching to edit, focus the textarea
  useEffect(() => {
    if (view === "edit" && mounted && prevViewRef.current !== "edit") {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    prevViewRef.current = view
  }, [view, mounted])

  const handleSave = () => {
    if (displayName.trim() && data.trim()) {
      onSave(displayName.trim(), data.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  const canSave = displayName.trim() && data.trim()

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-white dark:bg-neutral-900 flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Top bar */}
      <div className="shrink-0 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-3xl mx-auto w-full px-6 h-14 flex items-center">
          {/* Left */}
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 text-sm text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors duration-150 -ml-1"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          </div>

          {/* Center */}
          <h2 id={titleId} className="shrink-0 text-sm font-medium text-black/70 dark:text-white/70">
            {mode === "add" ? "New Skill" : "Edit Skill"}
          </h2>

          {/* Right - Preview / Edit toggle */}
          <div className="flex-1 flex justify-end">
            <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.04] rounded-full p-0.5">
              <button
                type="button"
                onClick={() => setView("edit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  view === "edit"
                    ? "bg-white dark:bg-white/[0.12] text-black dark:text-white shadow-sm"
                    : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60"
                }`}
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setView("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  view === "preview"
                    ? "bg-white dark:bg-white/[0.12] text-black dark:text-white shadow-sm"
                    : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60"
                }`}
              >
                <Eye size={12} />
                Preview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content area - centered, max-width for readability */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-6 py-8">
          {view === "edit" ? (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label
                  htmlFor="prompt-name"
                  className="block text-sm font-medium text-black/60 dark:text-white/60 mb-2"
                >
                  Name
                </label>
                <input
                  ref={nameInputRef}
                  id="prompt-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Code Review, Fix Bugs"
                  className="w-full px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-sm text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-black/[0.12] dark:focus:ring-white/[0.12] focus:border-black/[0.12] dark:focus:border-white/[0.12] transition-all duration-150"
                />
              </div>

              {/* Prompt */}
              <div className="flex flex-col">
                <label
                  htmlFor="prompt-content"
                  className="block text-sm font-medium text-black/60 dark:text-white/60 mb-2"
                >
                  Prompt
                </label>
                <textarea
                  ref={textareaRef}
                  id="prompt-content"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  placeholder="Describe what this skill should do..."
                  className="w-full min-h-[50vh] px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-sm leading-relaxed text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-black/[0.12] dark:focus:ring-white/[0.12] focus:border-black/[0.12] dark:focus:border-white/[0.12] transition-all duration-150 resize-none"
                />
              </div>
            </div>
          ) : (
            /* Preview mode - read-only, nice typography */
            <div className="space-y-6">
              <div>
                <p className="text-xs text-black/40 dark:text-white/40 mb-1">Name</p>
                <h3 className="text-lg font-medium text-black dark:text-white">
                  {displayName || <span className="text-black/20 dark:text-white/20">Untitled</span>}
                </h3>
              </div>

              <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-6">
                <p className="text-xs text-black/40 dark:text-white/40 mb-3">Prompt</p>
                {data ? (
                  <div className="text-sm leading-relaxed text-black/80 dark:text-white/80 whitespace-pre-wrap">
                    {data}
                  </div>
                ) : (
                  <p className="text-sm text-black/20 dark:text-white/20">No content yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-3xl mx-auto w-full px-6 h-16 flex items-center justify-between">
          <p className="text-xs text-black/30 dark:text-white/30">
            <kbd className="px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.04] rounded text-[10px] font-medium">
              {"\u2318"}Enter
            </kbd>{" "}
            to save
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 px-4 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.09] active:bg-black/[0.10] dark:active:bg-white/[0.12] text-black/70 dark:text-white/70 rounded-xl text-sm font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="h-10 px-5 bg-black dark:bg-white text-white dark:text-black hover:brightness-[0.85] active:brightness-75 active:scale-[0.98] rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-30 disabled:hover:brightness-100"
            >
              {mode === "add" ? "Add Skill" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
