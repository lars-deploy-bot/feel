"use client"

import { X } from "lucide-react"
import { useState } from "react"

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
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [data, setData] = useState(initialData)

  const handleSave = () => {
    if (displayName.trim() && data.trim()) {
      onSave(displayName.trim(), data.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSave()
    }
    // Escape to cancel
    if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  const canSave = displayName.trim() && data.trim()

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-editor-title"
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="document"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20">
          <div>
            <h2 id="prompt-editor-title" className="text-xl font-semibold text-black dark:text-white">
              {mode === "add" ? "Add New Prompt" : "Edit Prompt"}
            </h2>
            <p className="text-xs text-black/60 dark:text-white/60 mt-1">
              Use <kbd className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[10px]">Cmd+Enter</kbd> to
              save
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all duration-200"
            aria-label="Close editor"
          >
            <X size={20} className="text-black/60 dark:text-white/60" />
          </button>
        </div>

        {/* Prompt Name */}
        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <label htmlFor="prompt-name" className="block text-sm font-medium text-black dark:text-white mb-2">
            Prompt Name
          </label>
          <input
            id="prompt-name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g., 'Revise Code', 'Fix Bugs', 'Write Tests'"
            className="w-full px-4 py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
            <label htmlFor="prompt-content" className="text-sm font-medium text-black dark:text-white">
              Prompt Content
            </label>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <textarea
              id="prompt-content"
              value={data}
              onChange={e => setData(e.target.value)}
              placeholder="Enter your prompt text here"
              className="w-full h-full min-h-[400px] px-4 py-3 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors resize-none font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-end gap-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
            >
              {mode === "add" ? "Add Prompt" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
