import type { KanbanAdapter, KanbanCard, KanbanCardCreate, KanbanCardUpdate, KanbanColumnDef } from "./types"

const COLUMNS: readonly KanbanColumnDef[] = [
  { id: "todo", label: "To Do", color: "#6B7280" },
  { id: "in-progress", label: "In Progress", color: "#3B82F6" },
  { id: "review", label: "Review", color: "#F59E0B" },
  { id: "done", label: "Done", color: "#10B981", collapsedByDefault: true },
] as const

const SEED_CARDS: KanbanCard[] = [
  {
    id: "c1",
    columnId: "todo",
    order: 0,
    priority: "high",
    title: "Set up CI pipeline for staging",
    description: "Configure GitHub Actions to deploy to staging on push to dev branch.",
    notes: "",
    attachments: [{ url: "https://docs.github.com/en/actions", label: "GH Actions docs" }],
    createdAt: "2026-03-14T10:00:00Z",
    dueDate: "2026-03-20",
  },
  {
    id: "c2",
    columnId: "todo",
    order: 1,
    priority: "medium",
    title: "Write adapter for Supabase tasks",
    description: "Map app.tasks table to the kanban adapter interface so cards persist.",
    notes: "Check if we need RLS policies for multi-tenant isolation.",
    attachments: [],
    createdAt: "2026-03-14T10:01:00Z",
    dueDate: "2026-03-25",
  },
  {
    id: "c3",
    columnId: "todo",
    order: 2,
    priority: "low",
    title: "Add dark mode to landing page",
    description: "",
    notes: "",
    attachments: [],
    createdAt: "2026-03-14T10:02:00Z",
    dueDate: null,
  },
  {
    id: "c4",
    columnId: "in-progress",
    order: 0,
    priority: "high",
    title: "Implement kanban drag-drop",
    description: "Native HTML drag-drop for column-to-column card movement with optimistic updates.",
    notes: "Pointer sensor with 5px activation distance feels right.",
    attachments: [],
    createdAt: "2026-03-13T09:00:00Z",
    dueDate: "2026-03-16",
  },
  {
    id: "c5",
    columnId: "in-progress",
    order: 1,
    priority: "urgent",
    title: "Fix preview proxy WebSocket reconnect",
    description: "WebSocket connections drop silently when the preview proxy restarts.",
    notes: "",
    attachments: [
      { url: "https://github.com/lars-deploy-bot/feel/issues/42", label: "Issue #42" },
      { url: "https://sentry.sonno.tech/issues/891", label: "Sentry #891" },
    ],
    createdAt: "2026-03-13T09:01:00Z",
    dueDate: "2026-03-15",
  },
  {
    id: "c6",
    columnId: "review",
    order: 0,
    priority: "medium",
    title: "OAuth token refresh with jitter",
    description: "Add exponential backoff with jitter to OAuth refresh to avoid thundering herd.",
    notes: "Already have retryAsync in @webalive/shared, just wire it up.",
    attachments: [],
    createdAt: "2026-03-12T08:00:00Z",
    dueDate: "2026-03-18",
  },
  {
    id: "c7",
    columnId: "review",
    order: 1,
    priority: "medium",
    title: "Rate limiter for automation triggers",
    description: "",
    notes: "",
    attachments: [],
    createdAt: "2026-03-12T08:01:00Z",
    dueDate: null,
  },
  {
    id: "c8",
    columnId: "done",
    order: 0,
    priority: "none",
    title: "Deploy control plane v1",
    description: "Rust deployer service with build/release/deployment pipeline.",
    notes: "",
    attachments: [],
    createdAt: "2026-03-11T07:00:00Z",
    dueDate: null,
  },
  {
    id: "c9",
    columnId: "done",
    order: 1,
    priority: "none",
    title: "Process reaper cron job",
    description: "",
    notes: "",
    attachments: [],
    createdAt: "2026-03-10T06:00:00Z",
    dueDate: "2026-03-12",
  },
]

let counter = 100

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createMockAdapter(): KanbanAdapter {
  const store = new Map<string, KanbanCard>()

  for (const card of SEED_CARDS) {
    store.set(card.id, structuredClone(card))
  }

  return {
    queryKey: "kanban-mock",
    columns: COLUMNS,

    async fetchCards() {
      await delay(80)
      return [...store.values()].sort((a, b) => a.order - b.order)
    },

    async moveCard(cardId, toColumnId, order) {
      await delay(60)
      const card = store.get(cardId)
      if (!card) throw new Error(`Card ${cardId} not found`)
      store.set(cardId, { ...card, columnId: toColumnId, order })
    },

    async createCard(input: KanbanCardCreate) {
      await delay(100)
      const id = `c${++counter}`
      const card: KanbanCard = {
        id,
        columnId: input.columnId,
        order: [...store.values()].filter(c => c.columnId === input.columnId).length,
        title: input.title,
        description: input.description,
        priority: input.priority,
        notes: input.notes,
        attachments: input.attachments,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
      }
      store.set(id, card)
      return structuredClone(card)
    },

    async updateCard(cardId, updates: KanbanCardUpdate) {
      await delay(100)
      const card = store.get(cardId)
      if (!card) throw new Error(`Card ${cardId} not found`)
      store.set(cardId, { ...card, ...updates })
    },

    async deleteCard(cardId) {
      await delay(80)
      if (!store.has(cardId)) throw new Error(`Card ${cardId} not found`)
      store.delete(cardId)
    },
  }
}
