"use client"

import { create } from "zustand"
import type { Attachment } from "@/features/chat/components/ChatInput/types"

/**
 * Attachment store — keyed by tab ID, persisted to IndexedDB via Dexie.
 *
 * Attachments are per-tab. Switching tabs just reads a different key.
 * No serialize/deserialize, no imperative save/restore, no ref threading.
 *
 * Persistence model (like Gmail drafts):
 * - In-memory Zustand store is the working state during the session
 * - Changes auto-save to IndexedDB (debounced) via dexieMessageStore
 * - On tab switch / page load, draft attachments are loaded from IndexedDB
 * - `file-upload` attachments (non-serializable File objects) are NOT persisted
 */

interface AttachmentStoreState {
  byTab: Record<string, Attachment[]>
}

interface AttachmentStoreActions {
  get: (tabId: string) => Attachment[]
  set: (tabId: string, attachments: Attachment[]) => void
  update: (tabId: string, fn: (prev: Attachment[]) => Attachment[]) => void
  clear: (tabId: string) => void
  remove: (tabId: string) => void
  /** Load draft attachments from IndexedDB for a tab */
  loadFromDexie: (tabId: string) => Promise<void>
}

export const useAttachmentStore = create<AttachmentStoreState & AttachmentStoreActions>((set, get) => ({
  byTab: {},

  get: tabId => get().byTab[tabId] ?? [],

  set: (tabId, attachments) => {
    set(state => ({
      byTab: { ...state.byTab, [tabId]: attachments },
    }))
    scheduleDexieSave(tabId)
  },

  update: (tabId, fn) => {
    set(state => ({
      byTab: { ...state.byTab, [tabId]: fn(state.byTab[tabId] ?? []) },
    }))
    scheduleDexieSave(tabId)
  },

  clear: tabId => {
    set(state => ({
      byTab: { ...state.byTab, [tabId]: [] },
    }))
    scheduleDexieSave(tabId)
  },

  remove: tabId => {
    set(state => {
      const { [tabId]: _, ...rest } = state.byTab
      return { byTab: rest }
    })
    scheduleDexieSave(tabId)
  },

  loadFromDexie: async tabId => {
    // Lazy import to avoid circular dependency (dexieMessageStore → attachmentStore)
    const { useDexieMessageStore } = await import("@/lib/db/dexieMessageStore")
    const draft = await useDexieMessageStore.getState().loadDraft(tabId)
    const attachments = draft?.attachments
    if (attachments && attachments.length > 0) {
      set(state => ({
        byTab: { ...state.byTab, [tabId]: attachments },
      }))
    }
  },
}))

// =============================================================================
// Debounced Dexie save — auto-saves serializable attachments to IndexedDB
// =============================================================================

const saveTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
const SAVE_DEBOUNCE_MS = 500

function scheduleDexieSave(tabId: string): void {
  clearTimeout(saveTimeouts[tabId])
  saveTimeouts[tabId] = setTimeout(() => {
    void flushDexieSave(tabId)
  }, SAVE_DEBOUNCE_MS)
}

async function flushDexieSave(tabId: string): Promise<void> {
  const attachments = useAttachmentStore.getState().get(tabId)
  // Strip file-upload (non-serializable File objects, in-progress uploads)
  const serializable = attachments.filter(a => a.kind !== "file-upload")

  try {
    // Lazy import to avoid circular dependency
    const { useDexieMessageStore } = await import("@/lib/db/dexieMessageStore")
    await useDexieMessageStore.getState().saveDraft(tabId, { attachments: serializable })
  } catch {
    // Silent fail — draft save is best-effort
  }
}

// Atomic selector — returns attachments for a specific tab (empty array if null/missing)
export const useTabAttachments = (tabId: string | null) =>
  useAttachmentStore(s => (tabId ? (s.byTab[tabId] ?? []) : []))
