"use client"

import { useState } from "react"
import { PromptEditorModal } from "@/components/modals/PromptEditorModal"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { useUserPrompts, useUserPromptsActions } from "@/lib/providers/UserPromptsStoreProvider"
import { SettingsTabLayout } from "./SettingsTabLayout"

export function UserPromptsSettings() {
  const prompts = useUserPrompts()
  const { addPrompt, updatePrompt, removePrompt } = useUserPromptsActions()
  const [editorState, setEditorState] = useState<{
    mode: "add" | "edit"
    promptId?: string
    displayName: string
    data: string
  } | null>(null)

  const handleOpenEditor = (mode: "add" | "edit", promptId?: string, displayName = "", data = "") => {
    setEditorState({ mode, promptId, displayName, data })
  }

  const handleCloseEditor = () => {
    setEditorState(null)
  }

  const handleSavePrompt = (displayName: string, data: string) => {
    if (!editorState) return

    if (editorState.mode === "add") {
      const promptType = displayName.toLowerCase().replace(/\s+/g, "-")
      addPrompt(promptType, data, displayName)
    } else if (editorState.mode === "edit" && editorState.promptId) {
      updatePrompt(editorState.promptId, data, displayName)
    }

    setEditorState(null)
  }

  return (
    <SettingsTabLayout
      title="User Prompts"
      description="Manage your saved prompt templates that appear in the chat toolbar"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Add New Prompt Button */}
        <button
          type="button"
          onClick={() => handleOpenEditor("add")}
          className="w-full px-4 py-3 sm:py-2.5 border-2 border-dashed border-black/20 dark:border-white/20 rounded-lg text-sm font-medium text-black/60 dark:text-white/60 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white active:scale-[0.99] transition-all"
        >
          + Add New Prompt
        </button>

        {/* Saved Prompts List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {prompts.map(prompt => (
            <div
              key={prompt.id}
              className="px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">{prompt.displayName}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditor("edit", prompt.id, prompt.displayName, prompt.data)}
                    className="px-2 py-1 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removePrompt(prompt.id)}
                    className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-black/70 dark:text-white/70 line-clamp-6 overflow-hidden">
                <MarkdownDisplay content={prompt.data} />
              </div>
            </div>
          ))}
        </div>

        {prompts.length === 0 && (
          <div className="text-center py-8 text-black/40 dark:text-white/40 text-sm">
            No saved prompts yet. Click &quot;Add New Prompt&quot; to create one.
          </div>
        )}

        {/* Prompt Editor Modal */}
        {editorState && (
          <PromptEditorModal
            mode={editorState.mode}
            initialDisplayName={editorState.displayName}
            initialData={editorState.data}
            onSave={handleSavePrompt}
            onCancel={handleCloseEditor}
          />
        )}
      </div>
    </SettingsTabLayout>
  )
}
