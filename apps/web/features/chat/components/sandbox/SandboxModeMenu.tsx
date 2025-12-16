"use client"

import { Code, Globe } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { PreviewMode } from "../../lib/sandbox-context"

interface SandboxModeMenuProps {
  currentMode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
}

const MODE_OPTIONS: { mode: PreviewMode; label: string; icon: typeof Globe }[] = [
  { mode: "site", label: "Preview", icon: Globe },
  { mode: "code", label: "Code", icon: Code },
]

// Check if we're on mobile (client-side only)
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}

export function SandboxModeMenu({ currentMode, onModeChange }: SandboxModeMenuProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Force back to site mode if on mobile and in code mode
  useEffect(() => {
    if (isMobile && currentMode === "code") {
      onModeChange("site")
    }
  }, [isMobile, currentMode, onModeChange])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false)
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const handleSelect = (mode: PreviewMode) => {
    onModeChange(mode)
    setIsOpen(false)
  }

  // Don't show menu on mobile - only one option available
  if (isMobile) {
    return null
  }

  const CurrentIcon = MODE_OPTIONS.find(o => o.mode === currentMode)?.icon ?? Globe

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded transition-colors ${
          isOpen ? "bg-white/[0.08] text-neutral-200" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]"
        }`}
        title="Switch view"
        aria-label="Switch view"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <CurrentIcon size={14} strokeWidth={1.5} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1.5 w-32 bg-[#1a1a1a] border border-white/[0.08] rounded-lg shadow-xl shadow-black/40 z-50 overflow-hidden"
        >
          <div className="py-1">
            {MODE_OPTIONS.map(({ mode, label, icon: Icon }) => {
              const isActive = currentMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(mode)}
                  className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors ${
                    isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.5} className={isActive ? "text-white" : "text-neutral-500"} />
                  <span className="flex-1">{label}</span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
