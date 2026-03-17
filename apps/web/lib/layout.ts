/**
 * Layout invariants for the chat + workbench panel split.
 *
 * All sizes are percentages of the panel group.
 * react-resizable-panels enforces: CHAT.min + WORKBENCH.min ≤ 100
 *
 * The workbench is collapsible — when hidden it collapses to 0%.
 * This avoids layout shifts when toggling the workbench on/off.
 */

/** Chat panel — the primary panel, always visible */
export const CHAT_PANEL = {
  min: 25,
  default: 25,
  id: "chat-panel",
} as const

/** Workbench panel — collapsible secondary panel */
export const WORKBENCH_PANEL = {
  min: 20,
  default: 100 - CHAT_PANEL.default,
  collapsedSize: 0,
  id: "workbench-panel",
} as const

export const RESIZE_HANDLE_ID = "chat-workbench-handle"

/** Shared top bar height (px) — sidebar header, tab bar, workbench view switcher */
export const TOP_BAR_HEIGHT = 52

/** Sidebar collapsed rail layout — shared so adjacent content aligns vertically */
export const SIDEBAR_RAIL = {
  /** Vertical padding (px) of the rail container */
  paddingY: 8,
  /** Size of each rail icon button (px) */
  iconSize: 36,
  /** Gap between rail icon buttons (px) */
  gap: 4,
} as const
