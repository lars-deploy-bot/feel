"use client"

import { History, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Tab } from "@/lib/stores/tabStore"

interface TabBarProps {
  tabs: Tab[]
  closedTabs: Tab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabRename: (tabId: string, name: string) => void
  onTabReopen: (tabId: string) => void
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

export function TabBar({
  tabs,
  closedTabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabRename,
  onTabReopen,
  onAddTab,
}: TabBarProps) {
  const { editingId, editValue, setEditValue, inputRef, startEdit, commitEdit, handleKeyDown } =
    useInlineEdit(onTabRename)
  const [showClosedMenu, setShowClosedMenu] = useState(false)
  const closedBtnRef = useRef<HTMLButtonElement>(null)
  const closedMenuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // Position the portal dropdown below the trigger button
  useEffect(() => {
    if (!showClosedMenu || !closedBtnRef.current) return
    const rect = closedBtnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
  }, [showClosedMenu])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showClosedMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        closedMenuRef.current &&
        !closedMenuRef.current.contains(target) &&
        closedBtnRef.current &&
        !closedBtnRef.current.contains(target)
      ) {
        setShowClosedMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showClosedMenu])

  return (
    <div data-testid="tab-bar" className="flex-shrink-0 border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="px-3 md:px-6 mx-auto w-full md:max-w-2xl">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          {tabs.length > 0 && (
            <>
              {tabs.map(tab => {
                const isActive = tab.id === activeTabId
                const isEditing = tab.id === editingId

                return (
                  <div
                    key={tab.id}
                    data-testid={`tab-${tab.id}`}
                    data-tab-name={tab.name}
                    data-active={isActive}
                    className={`group flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg transition-all duration-150 min-w-0 ${
                      isActive
                        ? "bg-black/[0.08] dark:bg-white/[0.08] text-black/80 dark:text-white/80"
                        : "text-black/50 dark:text-white/50 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] hover:text-black/70 dark:hover:text-white/70"
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
                        data-testid={`close-tab-${tab.id}`}
                        className={`size-5 flex items-center justify-center rounded-md transition-all duration-150 hover:bg-black/[0.08] dark:hover:bg-white/[0.08] ${
                          isActive
                            ? "opacity-60 hover:opacity-100"
                            : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                        }`}
                        aria-label={`Close ${tab.name}`}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={onAddTab}
                data-testid="add-tab-button"
                className="flex items-center justify-center size-8 rounded-lg text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-150"
                title="Add new tab"
              >
                <Plus size={16} strokeWidth={1.75} />
              </button>
            </>
          )}
          {closedTabs.length > 0 && (
            <>
              <button
                ref={closedBtnRef}
                type="button"
                onClick={() => setShowClosedMenu(prev => !prev)}
                className="flex items-center justify-center size-8 rounded-lg text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-150"
                title="Reopen closed tab"
              >
                <History size={16} strokeWidth={1.75} />
              </button>
              {showClosedMenu &&
                createPortal(
                  <div
                    ref={closedMenuRef}
                    style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
                    className="z-[9999] min-w-44 max-w-64 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] py-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-3 py-2 text-[10px] font-medium text-black/40 dark:text-white/40 uppercase tracking-wider">
                      Closed tabs
                    </div>
                    {closedTabs.map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onTabReopen(tab.id)
                          setShowClosedMenu(false)
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.10] transition-colors truncate"
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
