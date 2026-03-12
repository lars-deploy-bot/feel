"use client"

import { History, Plus } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { trackTabClosed, trackTabCreated, trackTabReopened } from "@/lib/analytics/events"
import type { Tab } from "@/lib/stores/tabStore"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const ISLAND_BG = "bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.04]"

const ACTION_CIRCLE = `flex items-center justify-center size-8 rounded-full ${ISLAND_BG} transition-all duration-200`

const PILL_ACTIVE =
  "bg-white dark:bg-white/10 text-black dark:text-white shadow-[0_1px_4px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3),0_0_1px_rgba(255,255,255,0.05)]"

const PILL_INACTIVE = "text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 cursor-pointer"

// ─── Inline edit hook ────────────────────────────────────────────────────────

function useInlineEdit(onSave: (id: string, value: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const inputRef = useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    el.focus()
    el.select()
  }, [])

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

// ─── Swipe-to-close hook (mobile only) ──────────────────────────────────────

const SWIPE_THRESHOLD = 40

function useSwipeToClose(canClose: boolean, onClose: () => void) {
  const startY = useRef(0)
  const startX = useRef(0)
  const isTracking = useRef(false)
  const directionLocked = useRef<"vertical" | "horizontal" | null>(null)
  const [offsetY, setOffsetY] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canClose) return
      const touch = e.touches[0]
      startY.current = touch.clientY
      startX.current = touch.clientX
      isTracking.current = true
      directionLocked.current = null
      setIsSwiping(false)
    },
    [canClose],
  )

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return
    const touch = e.touches[0]
    const deltaY = startY.current - touch.clientY
    const deltaX = Math.abs(touch.clientX - startX.current)

    if (!directionLocked.current) {
      if (Math.abs(deltaY) > 5 || deltaX > 5) {
        directionLocked.current = deltaX > Math.abs(deltaY) ? "horizontal" : "vertical"
      }
    }

    if (directionLocked.current === "horizontal") {
      isTracking.current = false
      return
    }

    if (deltaY > 0) {
      e.preventDefault()
      setIsSwiping(true)
      setOffsetY(deltaY)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!isTracking.current && !isSwiping) return
    isTracking.current = false

    if (offsetY > SWIPE_THRESHOLD) {
      setIsClosing(true)
      setTimeout(() => {
        onClose()
        setIsClosing(false)
        setOffsetY(0)
        setIsSwiping(false)
      }, 200)
    } else {
      setOffsetY(0)
      setIsSwiping(false)
    }
  }, [offsetY, isSwiping, onClose])

  const style = useMemo<React.CSSProperties>(() => {
    if (isClosing) {
      return { transform: "translateY(-60px) scale(0.8)", opacity: 0, transition: "all 200ms ease-out" }
    }
    if (isSwiping) {
      const opacity = Math.max(0, 1 - offsetY / 100)
      const scale = Math.max(0.85, 1 - offsetY / 300)
      return { transform: `translateY(${-offsetY}px) scale(${scale})`, opacity, transition: "none" }
    }
    return {}
  }, [isClosing, isSwiping, offsetY])

  return { onTouchStart, onTouchMove, onTouchEnd, style, isSwiping: isSwiping || isClosing }
}

// ─── Tab Pill ────────────────────────────────────────────────────────────────

interface TabPillProps {
  tab: Tab
  isActive: boolean
  canClose: boolean
  editingId: string | null
  editValue: string
  inputRef: (el: HTMLInputElement | null) => void
  onSelect: () => void
  onClose: () => void
  onStartEdit: () => void
  onEditChange: (value: string) => void
  onEditCommit: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
}

function TabPill({
  tab,
  isActive,
  canClose,
  editingId,
  editValue,
  inputRef,
  onSelect,
  onClose,
  onStartEdit,
  onEditChange,
  onEditCommit,
  onEditKeyDown,
}: TabPillProps) {
  const isEditing = tab.id === editingId
  const swipe = useSwipeToClose(canClose, () => {
    trackTabClosed()
    onClose()
  })

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      data-testid={`tab-${tab.id}`}
      data-tab-name={tab.name}
      data-active={isActive}
      className={`flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium rounded-full shrink-0 select-none touch-pan-x ${isActive ? PILL_ACTIVE : PILL_INACTIVE} ${swipe.isSwiping ? "" : "transition-all duration-200"}`}
      style={swipe.style}
      onClick={() => {
        if (!isEditing) onSelect()
      }}
      onContextMenu={e => {
        if (canClose) {
          e.preventDefault()
          trackTabClosed()
          onClose()
        }
      }}
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
    >
      {isActive && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onKeyDown={onEditKeyDown}
            className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-black dark:text-white"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={onStartEdit}
            className="w-full truncate text-left bg-transparent border-none cursor-pointer"
          >
            {tab.name}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Closed Tabs Dropdown ────────────────────────────────────────────────────

interface ClosedTabsDropdownProps {
  tabs: Tab[]
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onReopen: (tabId: string) => void
  onClose: () => void
}

function ClosedTabsDropdown({ tabs, triggerRef, onReopen, onClose }: ClosedTabsDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Position centered below trigger
  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    const menuWidth = menu.offsetWidth
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8))
    menu.style.top = `${rect.bottom + 6}px`
    menu.style.left = `${left}px`
  }, [triggerRef])

  useLayoutEffect(reposition, [reposition])

  useEffect(() => {
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [reposition])

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [triggerRef, onClose])

  // Escape key to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Closed tabs"
      style={{ position: "fixed" }}
      className="z-[9999] flex flex-col gap-0.5 p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06] rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] min-w-[180px] max-w-[280px]"
    >
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          type="button"
          role="menuitem"
          onClick={() => {
            trackTabReopened()
            onReopen(tab.id)
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-150 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm group/item"
          style={i < 8 ? { animation: `fadeSlideIn 200ms ${i * 40}ms both` } : undefined}
        >
          <span className="size-1.5 rounded-full bg-black/10 dark:bg-white/10 shrink-0 group-hover/item:bg-emerald-500 transition-colors" />
          <span className="flex-1 min-w-0 text-[13px] font-medium text-black/40 dark:text-white/40 group-hover/item:text-black dark:group-hover/item:text-white truncate transition-colors">
            {tab.name}
          </span>
          {tab.closedAt && (
            <span className="text-[10px] text-black/20 dark:text-white/20 shrink-0 tabular-nums">
              {timeAgo(tab.closedAt)}
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body,
  )
}

// ─── TabBar ──────────────────────────────────────────────────────────────────

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
  const closeMenu = useCallback(() => setShowClosedMenu(false), [])

  return (
    <div data-testid="tab-bar" className="flex-shrink-0 overflow-hidden">
      <div className="px-3 md:px-6 mx-auto w-full">
        <div className="group/bar flex flex-col items-center py-2">
          {tabs.length > 0 && (
            <div className="inline-flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-hide">
              {/* Island */}
              <div role="tablist" className={`inline-flex items-center gap-1.5 px-1.5 py-1 rounded-full ${ISLAND_BG}`}>
                {tabs.map(tab => (
                  <TabPill
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    canClose={tabs.length > 1}
                    editingId={editingId}
                    editValue={editValue}
                    inputRef={inputRef}
                    onSelect={() => onTabSelect(tab.id)}
                    onClose={() => onTabClose(tab.id)}
                    onStartEdit={() => startEdit(tab.id, tab.name)}
                    onEditChange={setEditValue}
                    onEditCommit={commitEdit}
                    onEditKeyDown={handleKeyDown}
                  />
                ))}
              </div>

              {/* Action circles */}
              <div className="inline-flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    trackTabCreated()
                    onAddTab()
                  }}
                  data-testid="add-tab-button"
                  className={`${ACTION_CIRCLE} text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]`}
                  aria-label="Add new tab"
                  title="Add new tab"
                >
                  <Plus size={14} strokeWidth={2} />
                </button>
                {closedTabs.length > 0 && (
                  <button
                    ref={closedBtnRef}
                    type="button"
                    onClick={() => setShowClosedMenu(prev => !prev)}
                    className={`${ACTION_CIRCLE} text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]`}
                    aria-label="Reopen closed tab"
                    aria-haspopup="menu"
                    aria-expanded={showClosedMenu}
                    title="Reopen closed tab"
                  >
                    <History size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          )}

          {tabs.length > 1 && (
            <>
              <span className="hidden md:block text-[10px] text-black/0 dark:text-white/0 group-hover/bar:text-black/25 dark:group-hover/bar:text-white/25 transition-colors duration-300 mt-0.5 select-none">
                right-click to archive
              </span>
              <span className="md:hidden text-[10px] text-black/25 dark:text-white/25 mt-0.5 select-none">
                swipe up to close
              </span>
            </>
          )}

          {showClosedMenu && (
            <ClosedTabsDropdown
              tabs={closedTabs}
              triggerRef={closedBtnRef}
              onReopen={tabId => {
                onTabReopen(tabId)
                setShowClosedMenu(false)
              }}
              onClose={closeMenu}
            />
          )}
        </div>
      </div>
    </div>
  )
}
