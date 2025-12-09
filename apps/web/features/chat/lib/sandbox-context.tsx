"use client"
import { createContext, type ReactNode, useCallback, useContext, useState } from "react"

export interface SandboxEntry {
  id: string
  timestamp: string
  type: "log" | "error" | "info" | "success"
  message: string
  data?: unknown
}

/** Element selection context from alive-tagger Cmd+Click */
export interface ElementSelection {
  displayName: string
  fileName: string
  lineNumber: number
  columnNumber?: number
}

interface SandboxContextType {
  entries: SandboxEntry[]
  addEntry: (entry: Omit<SandboxEntry, "id" | "timestamp">) => void
  clearEntries: () => void
  /** Currently selected element (from alive-tagger) */
  selectedElement: ElementSelection | null
  /** Set selected element - called from Sandbox when receiving postMessage */
  setSelectedElement: (element: ElementSelection | null) => void
  /** Callback for when element is selected - set by chat page to insert into input */
  onElementSelect: ((element: ElementSelection) => void) | null
  /** Register the callback for element selection */
  registerElementSelectHandler: (handler: (element: ElementSelection) => void) => void
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined)

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SandboxEntry[]>([])
  const [selectedElement, setSelectedElementState] = useState<ElementSelection | null>(null)
  const [onElementSelect, setOnElementSelect] = useState<((element: ElementSelection) => void) | null>(null)

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

  const setSelectedElement = useCallback(
    (element: ElementSelection | null) => {
      setSelectedElementState(element)
      if (element && onElementSelect) {
        onElementSelect(element)
      }
    },
    [onElementSelect],
  )

  const registerElementSelectHandler = useCallback((handler: (element: ElementSelection) => void) => {
    setOnElementSelect(() => handler)
  }, [])

  return (
    <SandboxContext.Provider
      value={{
        entries,
        addEntry,
        clearEntries,
        selectedElement,
        setSelectedElement,
        onElementSelect,
        registerElementSelectHandler,
      }}
    >
      {children}
    </SandboxContext.Provider>
  )
}

export function useSandboxContext() {
  const context = useContext(SandboxContext)
  if (!context) {
    throw new Error("useSandboxContext must be used within SandboxProvider")
  }
  return context
}
