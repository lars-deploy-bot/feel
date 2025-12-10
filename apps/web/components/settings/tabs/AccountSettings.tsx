"use client"

import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { useWorkspaceActions } from "@/lib/stores/workspaceStore"
import { SettingsTabLayout, type SettingsTabProps } from "./SettingsTabLayout"

export function AccountSettings({ onClose }: SettingsTabProps) {
  // Get email from auth session (read-only)
  const { user } = useAuth()
  const router = useRouter()
  const { setCurrentWorkspace } = useWorkspaceActions()

  // Theme state
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      })
      // Clear workspace from store
      setCurrentWorkspace(null)
      // Redirect to login
      router.push("/")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <SettingsTabLayout title="Profile" description="Your account information and preferences" onClose={onClose}>
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <p className="text-sm font-medium text-black dark:text-white mb-2">Email Address</p>
          <div className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded text-sm text-black dark:text-white">
            {user?.email || "—"}
          </div>
        </div>

        {/* Theme Section */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-175">
          <p className="text-sm font-medium text-black dark:text-white mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "light"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <Sun size={18} className="sm:w-5 sm:h-5 text-black dark:text-white" />
              <span className="text-xs text-black/60 dark:text-white/60 text-center">Light</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "dark"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <Moon size={18} className="sm:w-5 sm:h-5 text-black dark:text-white" />
              <span className="text-xs text-black/60 dark:text-white/60 text-center">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "system"
                  ? "border-2 border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1">
                <Sun size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
                <Moon size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
              </div>
              <span className="text-xs font-medium text-black dark:text-white text-center">System</span>
            </button>
          </div>
        </div>

        {/* Logout Section */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-200">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            data-testid="logout-button"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </SettingsTabLayout>
  )
}
