"use client"

import { Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Tab } from "@/lib/stores/tabStore"

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabRename: (tabId: string, name: string) => void
  onAddTab: () => void
}

/** Hook for inline tab name editing */
function useInlineEdit(onSave: (id: string, value: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingId])

  const startEdit = useCallback((id: string, currentValue: string) => {
    setEditingId(id)
    setEditValue(currentValue)
  }, [])

  const commitEdit = useCallback(() => {
    if (editingId) {
      onSave(editingId, editValue)
      setEditingId(null)
    }
  }, [editingId, editValue, onSave])

  const cancelEdit = useCallback(() => setEditingId(null), [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit()
      else if (e.key === "Escape") cancelEdit()
    },
    [commitEdit, cancelEdit],
  )

  return { editingId, editValue, setEditValue, inputRef, startEdit, commitEdit, handleKeyDown }
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onTabRename, onAddTab }: TabBarProps) {
  const { editingId, editValue, setEditValue, inputRef, startEdit, commitEdit, handleKeyDown } =
    useInlineEdit(onTabRename)

  return (
    <div className="flex-shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
      <div className="px-4 md:px-6 mx-auto w-full md:max-w-2xl">
        <div className="flex items-center gap-1 py-1.5 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            const isEditing = tab.id === editingId

            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors min-w-0 ${
                  isActive
                    ? "bg-black/10 dark:bg-white/10 text-black dark:text-white"
                    : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black/70 dark:hover:text-white/70"
                }`}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none w-20 text-xs font-medium text-black dark:text-white"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onTabSelect(tab.id)}
                    onDoubleClick={() => startEdit(tab.id, tab.name)}
                    className="truncate max-w-24 bg-transparent border-none cursor-pointer"
                  >
                    {tab.name}
                  </button>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      onTabClose(tab.id)
                    }}
                    className={`p-0.5 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${
                      isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                    }`}
                    aria-label={`Close ${tab.name}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={onAddTab}
            className="flex items-center justify-center p-1 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
            title="Add new tab"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
