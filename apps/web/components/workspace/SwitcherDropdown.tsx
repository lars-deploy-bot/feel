"use client"

import { Check, Search } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

// ─── Styles ──────────────────────────────────────────────────────────────────

const DROPDOWN =
  "z-[9999] w-72 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06] rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden"

const ITEM = "flex items-center gap-3 w-full px-2.5 py-1.5 rounded-lg text-left text-[13px] transition-all duration-150"

const ITEM_HIGHLIGHT = "bg-black/[0.04] dark:bg-white/[0.06]"
const ITEM_HOVER = "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"

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
}: SwitcherDropdownProps<T>) {
  const [search, setSearch] = useState("")
  const [highlight, setHighlight] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus search input via callback ref (no useEffect needed)
  const searchRef = useCallback((el: HTMLInputElement | null) => el?.focus(), [])

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

  // ─── Click outside to close ──────────────────────────────────────────────

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

  // ─── Filter + keyboard navigation ────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(item => getLabel(item).toLowerCase().includes(q))
  }, [items, search, getLabel])

  const activeKey = activeItem ? getKey(activeItem) : null

  // Reset highlight when search changes
  useEffect(() => setHighlight(0), [search])

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
          setHighlight(i => Math.min(i + 1, filtered.length - 1))
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
    <div role="listbox" ref={menuRef} style={{ position: "fixed" }} className={DROPDOWN} onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2 px-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <Search size={14} strokeWidth={2} className="text-black/25 dark:text-white/25 shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-activedescendant={filtered[highlight] ? `switcher-item-${getKey(filtered[highlight])}` : undefined}
          className="flex-1 h-9 bg-transparent text-[13px] text-black dark:text-white placeholder:text-black/25 dark:placeholder:text-white/25 outline-none border-none"
        />
      </div>

      <div ref={listRef} className="max-h-[240px] overflow-y-auto p-1 flex flex-col gap-0.5">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-[13px] text-black/30 dark:text-white/30 text-center">Nothing found</div>
        ) : (
          filtered.map((item, i) => {
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
                className={`${ITEM} ${i === highlight ? ITEM_HIGHLIGHT : ITEM_HOVER}`}
                style={i < 8 ? { animation: `fadeSlideIn 150ms ${i * 20}ms both` } : undefined}
              >
                <span
                  className={`size-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"}`}
                />
                <span
                  className={`flex-1 truncate ${isActive ? "text-black dark:text-white font-medium" : "text-black/50 dark:text-white/50"}`}
                >
                  {getLabel(item)}
                </span>
                {isActive && <Check size={14} strokeWidth={2} className="text-black/40 dark:text-white/40 shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
