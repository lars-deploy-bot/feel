import type { DbConversation } from "@/lib/db/messageDb"

/** A workspace with its grouped conversations */
export interface WorkspaceGroup {
  workspace: string
  isFavorite: boolean
  conversations: DbConversation[]
}
