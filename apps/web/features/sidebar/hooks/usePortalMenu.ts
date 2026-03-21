"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface PortalMenuPosition {
  top?: number
  bottom?: number
  left: number
}

/**
 * Shared portal menu behavior: open/close state, positioning, click-outside, Escape key.
 * Used by WorkspaceGroupMenu and AccountMenu.
 */
export function usePortalMenu(anchor: "below" | "above" = "below") {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<PortalMenuPosition>({ left: 0 })

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (anchor === "below") {
      setPos({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 200),
      })
    } else {
      setPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      })
    }
  }, [anchor])

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener("resize", updatePosition)
    // Close on scroll — the menu is portaled to body with fixed position,
    // so scrolling the sidebar would leave it floating in the wrong place
    const handleScroll = () => setOpen(false)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [open, updatePosition])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return
      if (menuRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const toggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setOpen(prev => !prev)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, pos, triggerRef, menuRef, toggle, close }
}
