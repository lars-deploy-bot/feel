"use client"

import { Plus, X } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

// ─── Styles ──────────────────────────────────────────────────────────────────

const DROPDOWN =
  "z-[9999] w-[calc(100vw-16px)] max-w-96 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden"

// ─── Component ───────────────────────────────────────────────────────────────

interface SwitcherDropdownProps<T> {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  items: T[]
  activeItem: T | null
  getKey: (item: T) => string
  getLabel: (item: T) => string
  placeholder: string
  onSelect: (item: T) => void
  onClose: () => void
  /** Footer action button (e.g. "Create Team") */
  footerAction?: { label: string; description?: string; onClick: () => void }
}

export function SwitcherDropdown<T>({
  triggerRef,
  items,
  activeItem,
  getKey,
  getLabel,
  placeholder,
  onSelect,
  onClose,
  footerAction,
}: SwitcherDropdownProps<T>) {
  const [search, setSearch] = useState("")
  const [highlight, setHighlight] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus search input on desktop only — on mobile, focus opens the keyboard
  const searchRef = useCallback((el: HTMLInputElement | null) => {
    if (el && window.matchMedia("(pointer: fine)").matches) {
      el.focus()
    }
  }, [])

  // ─── Position below trigger + reposition on resize/scroll ────────────────

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))
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

  // ─── Click / tap outside to close ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [triggerRef, onClose])

  // ─── Filter + keyboard navigation ────────────────────────────────────────

  const activeKey = activeItem ? getKey(activeItem) : null

  const filtered = useMemo(() => {
    const base = search ? items.filter(item => getLabel(item).toLowerCase().includes(search.toLowerCase())) : items
    if (!activeKey) return base
    // Active item always first
    return base.toSorted((a, b) => {
      const aActive = getKey(a) === activeKey ? 0 : 1
      const bActive = getKey(b) === activeKey ? 0 : 1
      return aActive - bActive
    })
  }, [items, search, getLabel, getKey, activeKey])

  // Reset highlight when search changes
  useEffect(() => setHighlight(-1), [search])

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children.item(highlight)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [highlight])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          if (filtered.length === 0) break
          setHighlight(i => (i < 0 ? 0 : Math.min(i + 1, filtered.length - 1)))
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlight(i => Math.max(i - 1, 0))
          break
        case "Enter":
          if (filtered[highlight]) onSelect(filtered[highlight])
          break
        case "Escape":
          onClose()
          break
      }
    },
    [filtered, highlight, onSelect, onClose],
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  return createPortal(
    <div role="dialog" ref={menuRef} style={{ position: "fixed" }} className={DROPDOWN} onKeyDown={handleKeyDown}>
      {/* Search bar */}
      <label className="flex items-center gap-2.5 border-b border-black/[0.08] dark:border-white/[0.08]">
        <input
          ref={searchRef}
          role="combobox"
          aria-controls="switcher-options"
          aria-expanded="true"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-activedescendant={filtered[highlight] ? `switcher-item-${getKey(filtered[highlight])}` : undefined}
          className="flex-1 h-10 bg-transparent text-sm text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 outline-none border-none px-4"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid w-10 h-10 place-content-center bg-transparent border-none cursor-pointer shrink-0"
        >
          <X size={16} strokeWidth={2} className="text-black/30 dark:text-white/30" />
        </button>
      </label>

      {/* Items list */}
      <div id="switcher-options" role="listbox" ref={listRef} className="max-h-[332px] overflow-y-auto p-0.5">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-black/30 dark:text-white/30 text-center">Nothing found</div>
        ) : (
          <div className="relative flex flex-col p-1">
            {filtered.map((item, i) => {
              const key = getKey(item)
              const isActive = key === activeKey
              return (
                <button
                  key={key}
                  id={`switcher-item-${key}`}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`group/result flex items-center gap-3 w-full px-2 py-2.5 rounded text-left text-sm transition-colors duration-100 ${
                    i === highlight
                      ? "bg-black/[0.04] dark:bg-white/[0.06]"
                      : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="grid size-5 place-content-center shrink-0">
                    <span
                      className={`size-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-black/[0.12] dark:bg-white/[0.12]"}`}
                    />
                  </span>
                  <span className="flex-1 truncate text-black/80 dark:text-white/80">{getLabel(item)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer action */}
      {footerAction && (
        <div className="border-t border-black/[0.08] dark:border-white/[0.08] p-1.5">
          <button
            type="button"
            onClick={footerAction.onClick}
            className="flex items-center gap-3 w-full px-2 py-2.5 rounded bg-transparent cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-100"
          >
            <span className="grid size-5 place-content-center shrink-0">
              <Plus size={16} strokeWidth={2} className="text-black/50 dark:text-white/50" />
            </span>
            <span className="text-sm text-black/80 dark:text-white/80">{footerAction.label}</span>
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
