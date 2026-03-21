/**
 * Types for alive-tagger
 */

/**
 * Source info attached to DOM elements
 */
export interface SourceInfo {
  /** Relative file path, e.g. "client/pages/Index.tsx" */
  fileName: string
  /** 1-indexed line number */
  lineNumber: number
  /** 1-indexed column number */
  columnNumber: number
  /** Component name or HTML tag name */
  displayName: string
}

/**
 * Symbol key used to store source info on DOM elements
 */
export const SOURCE_KEY = Symbol.for("__aliveSource__")

/**
 * PostMessage types for parent↔iframe communication
 */
export const ELEMENT_SELECTED_MESSAGE_TYPE = "alive-element-selected" as const
/** Parent → iframe: activate selector mode */
export const TAGGER_ACTIVATE = "alive-tagger-activate" as const
/** Parent → iframe: deactivate selector mode */
export const TAGGER_DEACTIVATE = "alive-tagger-deactivate" as const
/** Iframe → parent: selector was activated (e.g. Cmd/Ctrl held) */
export const TAGGER_ACTIVATED = "alive-tagger-activated" as const
/** Iframe → parent: selector was deactivated (e.g. Cmd/Ctrl released, Escape) */
export const TAGGER_DEACTIVATED = "alive-tagger-deactivated" as const

/**
 * Context sent when an element is selected
 */
export interface ElementSelectedContext {
  /** Relative file path */
  fileName: string
  /** Line number in source file */
  lineNumber: number
  /** Column number in source file */
  columnNumber: number
  /** Component or tag name */
  displayName: string
  /** Truncated HTML of the element */
  html: string
  /** Lowercase tag name */
  tagName: string
  /** CSS classes on the element */
  className: string
  /** Element id if present */
  id: string
  /** Parent component stack */
  parentComponents: string[]
}

/**
 * PostMessage payload for element selection
 */
export interface ElementSelectedMessage {
  type: typeof ELEMENT_SELECTED_MESSAGE_TYPE
  context: ElementSelectedContext
}

/**
 * Vite plugin options
 */
export interface AliveTaggerOptions {
  /** Enable JSX source tagging (default: true in dev) */
  enabled?: boolean
  /** Enable debug logging */
  debug?: boolean
}
