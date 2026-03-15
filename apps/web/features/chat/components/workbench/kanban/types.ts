// ── Kanban Adapter Pattern ──────────────────────────────────────────────────
// One interface per data source. Adapter maps domain data → flat KanbanCard.
// No generics leak into UI — adapter is the boundary.
// Fields map 1:1 to Linear/Jira/GitHub Issues — keep it minimal.

export type KanbanPriority = "none" | "low" | "medium" | "high" | "urgent"

export type KanbanSortField = "manual" | "priority" | "created" | "due" | "title"

export interface KanbanColumnDef {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly collapsedByDefault?: boolean
}

export interface KanbanAttachment {
  readonly url: string
  readonly label: string
}

export interface KanbanCard {
  readonly id: string
  readonly columnId: string
  readonly order: number
  readonly title: string
  readonly description: string
  readonly priority: KanbanPriority
  readonly notes: string
  readonly attachments: readonly KanbanAttachment[]
  readonly createdAt: string
  readonly dueDate: string | null
}

export interface KanbanCardCreate {
  readonly columnId: string
  readonly title: string
  readonly description: string
  readonly priority: KanbanPriority
  readonly notes: string
  readonly attachments: readonly KanbanAttachment[]
  readonly dueDate: string | null
}

export interface KanbanCardUpdate {
  readonly title?: string
  readonly description?: string
  readonly priority?: KanbanPriority
  readonly notes?: string
  readonly attachments?: readonly KanbanAttachment[]
  readonly dueDate?: string | null
}

export interface KanbanAdapter {
  readonly queryKey: string
  readonly columns: readonly KanbanColumnDef[]
  fetchCards(): Promise<KanbanCard[]>
  moveCard(cardId: string, toColumnId: string, order: number): Promise<void>
  createCard(input: KanbanCardCreate): Promise<KanbanCard>
  updateCard(cardId: string, updates: KanbanCardUpdate): Promise<void>
  deleteCard(cardId: string): Promise<void>
}
