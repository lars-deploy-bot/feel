"use client"

import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface TooltipProps {
  content: string
  children: ReactNode
  side?: "top" | "bottom"
  delayMs?: number
}

export function Tooltip({ content, children, side = "top", delayMs = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs)
  }, [delayMs])

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }, [])

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({
      x: rect.left + rect.width / 2,
      y: side === "top" ? rect.top - 8 : rect.bottom + 8,
    })
  }, [visible, side])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tooltip trigger is hover-only by design
    <span ref={triggerRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <span
            role="tooltip"
            style={{
              left: coords.x,
              top: coords.y,
              transform: `translate(-50%, ${side === "top" ? "-100%" : "0"})`,
            }}
            className="fixed px-2 py-1 text-xs font-medium text-white dark:text-black bg-neutral-800 dark:bg-neutral-200 rounded-md whitespace-nowrap pointer-events-none z-[9999]"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  )
}
