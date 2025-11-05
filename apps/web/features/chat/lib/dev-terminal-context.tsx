"use client"
import { createContext, type ReactNode, useContext, useState } from "react"

// Flexible event type for dev terminal (not strictly typed like StreamEvent from message-parser)
export interface DevStreamEvent {
  type: string
  requestId: string
  timestamp: string
  data: unknown
}

export interface DevSSEEvent {
  event: DevStreamEvent
  eventName: string // The SSE event name like "bridge_start", "ping", etc.
  rawSSE: string // The raw SSE format string
}

interface DevTerminalContextType {
  events: DevSSEEvent[]
  addEvent: (event: DevSSEEvent) => void
  clearEvents: () => void
}

const DevTerminalContext = createContext<DevTerminalContextType | undefined>(undefined)

export function DevTerminalProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<DevSSEEvent[]>([])

  const addEvent = (event: DevSSEEvent) => {
    setEvents(prev => [...prev, event])
  }

  const clearEvents = () => {
    setEvents([])
  }

  return <DevTerminalContext.Provider value={{ events, addEvent, clearEvents }}>{children}</DevTerminalContext.Provider>
}

export function useDevTerminal() {
  const context = useContext(DevTerminalContext)
  if (!context) {
    throw new Error("useDevTerminal must be used within DevTerminalProvider")
  }
  return context
}
