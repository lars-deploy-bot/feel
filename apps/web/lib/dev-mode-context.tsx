"use client"
import { createContext, type ReactNode, useContext, useState } from "react"

interface DevModeContextType {
  showDevContent: boolean
  toggleDevContent: () => void
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined)

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [showDevContent, setShowDevContent] = useState(true)

  const toggleDevContent = () => {
    setShowDevContent(prev => !prev)
  }

  return <DevModeContext.Provider value={{ showDevContent, toggleDevContent }}>{children}</DevModeContext.Provider>
}

/**
 * Hook to control the dev/prod content toggle in development mode
 * Returns the toggle state and function for the header button
 */
export function useDevMode() {
  const context = useContext(DevModeContext)
  if (!context) {
    throw new Error("useDevMode must be used within DevModeProvider")
  }
  return context
}

/**
 * Hook to check if debug content should be visible
 * - Production: Always false
 * - Development: Respects user toggle
 */
export function useDebugVisible() {
  const context = useContext(DevModeContext)
  return process.env.NODE_ENV === "development" && (context?.showDevContent ?? true)
}
