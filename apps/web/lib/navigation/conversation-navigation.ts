/**
 * Cross-component navigation to a specific conversation tab.
 *
 * Dispatches a custom DOM event that the chat page listens for.
 * This avoids prop-drilling through the settings overlay and lets
 * deeply nested components (e.g. AutomationRunsView) trigger
 * "close settings + open conversation" without coupling to the
 * modal/workspace/tab stores directly.
 */

export const NAVIGATE_TO_CONVERSATION_EVENT = "alive:navigate-to-conversation"

export interface NavigateToConversationDetail {
  workspace: string
  tabId: string
}

/** Dispatch from anywhere to navigate to a conversation tab in the chat UI. */
export function navigateToConversation(workspace: string, tabId: string): void {
  window.dispatchEvent(
    new CustomEvent<NavigateToConversationDetail>(NAVIGATE_TO_CONVERSATION_EVENT, {
      detail: { workspace, tabId },
    }),
  )
}

/** Type guard for extracting detail from a DOM event. */
export function parseNavigateEvent(e: Event): NavigateToConversationDetail | null {
  if (!(e instanceof CustomEvent)) return null
  const d: unknown = e.detail
  if (!d || typeof d !== "object") return null
  if (!("workspace" in d) || !("tabId" in d)) return null
  // After `in` narrows, TS knows d has `workspace` and `tabId` properties
  const { workspace, tabId } = d
  if (typeof workspace !== "string" || typeof tabId !== "string") return null
  return { workspace, tabId }
}
