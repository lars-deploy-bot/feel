/**
 * Layout invariants for the chat + workbench panel split.
 *
 * react-resizable-panels v4: bare numbers = pixels, strings = percentage/units.
 * We use pixel values for min sizes (stable across viewport widths)
 * and percentage strings for defaults.
 */

/** Chat panel — the primary panel, always visible */
export const CHAT_PANEL = {
  /** Minimum width in pixels — the resize handle cannot push chat below this */
  min: 380,
  /** Default size as percentage of the panel group */
  default: "30%",
  id: "chat-panel",
} as const

/** Workbench panel — collapsible secondary panel */
export const WORKBENCH_PANEL = {
  /** Minimum width in pixels when expanded */
  min: 200,
  /** Default size as percentage of the panel group */
  default: "70%",
  /** Collapsed to 0 when hidden */
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
