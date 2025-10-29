"use client"

import { Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function SettingsDropdown() {
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-8 h-8 text-black/60 hover:text-black transition-colors"
        type="button"
        aria-label="Settings"
      >
        <Settings size={16} />
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute top-full right-0 mt-2 w-48 bg-white border border-black/10 shadow-lg transition-all duration-200 ease-out origin-top-right ${
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        }`}
        style={{
          borderRadius: "2px",
        }}
      >
        <div className="py-1">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm text-black/80 hover:bg-black/5 transition-colors font-thin"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Invisible overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}