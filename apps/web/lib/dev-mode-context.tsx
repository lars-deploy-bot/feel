"use client"
import { createContext, type ReactNode, useContext, useState } from "react"

interface DevModeContextType {
  showDevContent: boolean
  toggleDevContent: () => void
}

export const DevModeContext = createContext<DevModeContextType | undefined>(undefined)

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [showDevContent, setShowDevContent] = useState(true)

  const toggleDevContent = () => {
    setShowDevContent(prev => !prev)
  }

  return <DevModeContext.Provider value={{ showDevContent, toggleDevContent }}>{children}</DevModeContext.Provider>
}

export function useDevMode() {
  const context = useContext(DevModeContext)
  if (!context) {
    throw new Error("useDevMode must be used within DevModeProvider")
  }
  return context
}
