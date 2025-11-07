"use client"
import { createContext, type ReactNode, useContext, useState } from "react"

export interface SandboxEntry {
  id: string
  timestamp: string
  type: "log" | "error" | "info" | "success"
  message: string
  data?: unknown
}

interface SandboxContextType {
  entries: SandboxEntry[]
  addEntry: (entry: Omit<SandboxEntry, "id" | "timestamp">) => void
  clearEntries: () => void
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined)

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SandboxEntry[]>([])

  const addEntry = (entry: Omit<SandboxEntry, "id" | "timestamp">) => {
    const newEntry: SandboxEntry = {
      ...entry,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    }
    setEntries(prev => [...prev, newEntry])
  }

  const clearEntries = () => {
    setEntries([])
  }

  return <SandboxContext.Provider value={{ entries, addEntry, clearEntries }}>{children}</SandboxContext.Provider>
}

export function useSandbox() {
  const context = useContext(SandboxContext)
  if (!context) {
    throw new Error("useSandbox must be used within SandboxProvider")
  }
  return context
}
