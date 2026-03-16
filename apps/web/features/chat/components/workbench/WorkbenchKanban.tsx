"use client"
import { useMemo } from "react"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { Kanban } from "./kanban/Kanban"
import { KanbanProvider } from "./kanban/KanbanProvider"
import { createMockAdapter } from "./kanban/mock-adapter"

export function WorkbenchKanban(_props: WorkbenchViewProps) {
  const adapter = useMemo(() => createMockAdapter(), [])

  return (
    <KanbanProvider adapter={adapter}>
      <Kanban />
    </KanbanProvider>
  )
}
