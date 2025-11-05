"use client"

import { Moon, Sun } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState } from "react"

interface SettingsDropdownProps {
  onNewChat?: () => void
  onPhotos?: () => void
}

export function SettingsDropdown({ onNewChat, onPhotos }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        type="button"
        aria-label="Menu"
      >
        Menu
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10 shadow-lg transition-all duration-200 ease-out origin-top-right ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        }`}
        style={{
          borderRadius: "2px",
        }}
      >
        <div className="py-1">
          {onNewChat && (
            <button
              onClick={() => handleAction(onNewChat)}
              className="w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
              type="button"
            >
              Start new chat
            </button>
          )}
          {onPhotos && (
            <button
              onClick={() => handleAction(onPhotos)}
              className="w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
              type="button"
            >
              Photos
            </button>
          )}
          <button
            onClick={() => handleAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
            className="w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium flex items-center gap-2"
            type="button"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="border-t border-black/10 dark:border-white/10 my-1" />
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Invisible overlay to close dropdown when clicking outside */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[-1]"
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
