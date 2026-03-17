import type { DbConversation } from "@/lib/db/messageDb"

/** A favorite workspace with its grouped conversations */
export interface WorkspaceGroup {
  workspace: string
  conversations: DbConversation[]
}
