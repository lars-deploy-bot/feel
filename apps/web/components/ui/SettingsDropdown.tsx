"use client"

import { Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface SettingsDropdownProps {
  onNewChat?: () => void
  currentWorkspace?: string
  onSwitchWorkspace?: (workspace: string) => void
  onOpenSettings?: () => void
}

export function SettingsDropdown({
  onNewChat,
  currentWorkspace: _currentWorkspace,
  onSwitchWorkspace: _onSwitchWorkspace,
  onOpenSettings,
}: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      })
      // Clear session storage
      sessionStorage.removeItem("workspace")
      // Redirect to login
      router.push("/")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        type="button"
        aria-label="Menu"
        data-testid="menu-button"
      >
        <span className="inline-flex">
          {"Menu".split("").map((letter, i) => (
            <span
              key={i}
              className={`inline-block transition-all duration-300 ease-out ${
                isOpen ? "-translate-y-0.5 opacity-70" : "translate-y-0 opacity-100"
              }`}
              style={{
                transitionDelay: isOpen ? `${i * 30}ms` : `${(3 - i) * 30}ms`,
              }}
            >
              {letter}
            </span>
          ))}
        </span>
      </button>

      <div
        className={`absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10 shadow-lg origin-top z-50 overflow-hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          borderRadius: "2px",
          maxHeight: isOpen ? "500px" : "0",
          transition: "max-height 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-in-out",
        }}
      >
        <div className="py-1">
          {onNewChat && (
            <button
              onClick={() => handleAction(onNewChat)}
              className="w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
              type="button"
              data-testid="new-chat-button"
            >
              Start new chat
            </button>
          )}
          <div className="border-t border-black/10 dark:border-white/10 my-1" />
          <button
            onClick={() => handleAction(() => onOpenSettings?.())}
            className="w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium flex items-center gap-2"
            type="button"
            data-testid="settings-button"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
            type="button"
            data-testid="logout-button"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Invisible overlay to close dropdown when clicking outside */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          onKeyDown={e => {
            if (e.key === "Escape") {
              setIsOpen(false)
            }
          }}
        />
      )}
    </div>
  )
}
