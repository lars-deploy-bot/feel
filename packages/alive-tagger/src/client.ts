/**
 * Alive Tagger Client
 *
 * Client-side script for element selection in the preview iframe.
 * Handles Cmd/Ctrl+Click detection and sends element context to parent frame.
 *
 * Usage:
 * - Hold Cmd (Mac) or Ctrl (Windows/Linux)
 * - Hover over elements to see highlights
 * - Click to select and send context to Claude Bridge
 */

import {
  SOURCE_KEY,
  ELEMENT_SELECTED_MESSAGE_TYPE,
  type SourceInfo,
  type ElementSelectedMessage,
  type ElementSelectedContext,
} from "./types"

/** Maximum length for HTML snippet */
const MAX_HTML_LENGTH = 500

/** Highlight color */
const HIGHLIGHT_COLOR = "#10b981" // Emerald green

/** Selection flash color */
const SELECTION_COLOR = "#3b82f6" // Blue

/**
 * Get source info from an element, walking up the tree if needed
 */
function getSourceInfo(element: Element): SourceInfo | null {
  let current: Element | null = element
  let depth = 0
  const maxDepth = 10

  while (current && depth < maxDepth) {
    const source = (current as unknown as Record<symbol, SourceInfo>)[SOURCE_KEY]
    if (source) {
      return source
    }
    current = current.parentElement
    depth++
  }

  return null
}

/**
 * Get parent component stack for context
 */
function getParentComponents(element: Element, maxDepth = 5): string[] {
  const components: string[] = []
  let current: Element | null = element.parentElement
  let depth = 0

  while (current && depth < maxDepth) {
    const source = (current as unknown as Record<symbol, SourceInfo>)[SOURCE_KEY]
    if (source && source.displayName) {
      // Only include React components (capitalized names), skip HTML tags
      if (source.displayName[0] === source.displayName[0].toUpperCase() && !/^[a-z]+$/.test(source.displayName)) {
        components.push(source.displayName)
      }
    }
    current = current.parentElement
    depth++
  }

  return components
}

/**
 * Build element context for sending to parent
 */
function buildContext(element: Element, source: SourceInfo): ElementSelectedContext {
  return {
    fileName: source.fileName,
    lineNumber: source.lineNumber,
    columnNumber: source.columnNumber,
    displayName: source.displayName,
    html: element.outerHTML.slice(0, MAX_HTML_LENGTH),
    tagName: element.tagName.toLowerCase(),
    className: element.className || "",
    id: element.id || "",
    parentComponents: getParentComponents(element),
  }
}

/**
 * Send element context to parent frame
 */
function sendToParent(context: ElementSelectedContext): void {
  const message: ElementSelectedMessage = {
    type: ELEMENT_SELECTED_MESSAGE_TYPE,
    context,
  }

  try {
    window.parent.postMessage(message, "*")
    console.log("[alive-tagger] Sent element context:", context.fileName + ":" + context.lineNumber)
  } catch (error) {
    console.error("[alive-tagger] Failed to send message:", error)
  }
}

/**
 * Create and manage the highlight overlay
 */
function createHighlightOverlay(): {
  show: (element: Element) => void
  hide: () => void
  flash: (element: Element) => void
} {
  // Create overlay element
  const overlay = document.createElement("div")
  overlay.id = "alive-tagger-overlay"
  overlay.style.cssText = `
		position: fixed;
		pointer-events: none;
		z-index: 999999;
		border: 2px solid ${HIGHLIGHT_COLOR};
		border-radius: 4px;
		background: ${HIGHLIGHT_COLOR}10;
		transition: all 0.1s ease-out;
		display: none;
	`

  // Create label element
  const label = document.createElement("div")
  label.id = "alive-tagger-label"
  label.style.cssText = `
		position: fixed;
		pointer-events: none;
		z-index: 999999;
		background: ${HIGHLIGHT_COLOR};
		color: white;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 3px;
		white-space: nowrap;
		display: none;
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
	`

  document.body.appendChild(overlay)
  document.body.appendChild(label)

  return {
    show(element: Element) {
      const rect = element.getBoundingClientRect()
      const source = getSourceInfo(element)

      // Position overlay
      overlay.style.left = `${rect.left}px`
      overlay.style.top = `${rect.top}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      overlay.style.display = "block"
      overlay.style.borderColor = HIGHLIGHT_COLOR
      overlay.style.background = `${HIGHLIGHT_COLOR}10`

      // Position and update label
      if (source) {
        label.textContent = `${source.displayName} · ${source.fileName}:${source.lineNumber}`
        label.style.left = `${rect.left}px`
        label.style.top = `${Math.max(0, rect.top - 24)}px`
        label.style.display = "block"
        label.style.background = HIGHLIGHT_COLOR
      } else {
        label.style.display = "none"
      }
    },

    hide() {
      overlay.style.display = "none"
      label.style.display = "none"
    },

    flash(element: Element) {
      const rect = element.getBoundingClientRect()

      overlay.style.left = `${rect.left}px`
      overlay.style.top = `${rect.top}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      overlay.style.borderColor = SELECTION_COLOR
      overlay.style.background = `${SELECTION_COLOR}20`
      overlay.style.display = "block"

      setTimeout(() => {
        overlay.style.borderColor = HIGHLIGHT_COLOR
        overlay.style.background = `${HIGHLIGHT_COLOR}10`
      }, 200)
    },
  }
}

/**
 * Initialize the element selector
 */
export function initAliveTagger(): () => void {
  // Don't run if not in iframe
  if (window.parent === window) {
    console.log("[alive-tagger] Not in iframe, skipping initialization")
    return () => {}
  }

  // Check if already initialized
  if ((window as unknown as Record<string, boolean>).__aliveTaggerInitialized) {
    console.log("[alive-tagger] Already initialized")
    return () => {}
  }
  ;(window as unknown as Record<string, boolean>).__aliveTaggerInitialized = true

  console.log("[alive-tagger] Initializing element selector")

  let isActive = false
  let hoveredElement: Element | null = null
  const highlight = createHighlightOverlay()

  // Track modifier key state
  function handleKeyDown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && !isActive) {
      isActive = true
      document.body.style.cursor = "crosshair"
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    if (!e.metaKey && !e.ctrlKey && isActive) {
      isActive = false
      document.body.style.cursor = ""
      highlight.hide()
      hoveredElement = null
    }
  }

  // Track mouse movement
  function handleMouseMove(e: MouseEvent): void {
    if (!isActive) return

    const target = e.target as Element

    // Skip if same element
    if (target === hoveredElement) return

    // Check if element has source info
    const source = getSourceInfo(target)
    if (source) {
      hoveredElement = target
      highlight.show(target)
    } else {
      hoveredElement = null
      highlight.hide()
    }
  }

  // Handle clicks
  function handleClick(e: MouseEvent): void {
    if (!isActive) return

    const target = e.target as Element
    const source = getSourceInfo(target)

    if (source) {
      e.preventDefault()
      e.stopPropagation()

      // Flash effect
      highlight.flash(target)

      // Build and send context
      const context = buildContext(target, source)
      sendToParent(context)
    }
  }

  // Handle window blur (deactivate when losing focus)
  function handleBlur(): void {
    isActive = false
    document.body.style.cursor = ""
    highlight.hide()
    hoveredElement = null
  }

  // Add event listeners
  document.addEventListener("keydown", handleKeyDown, true)
  document.addEventListener("keyup", handleKeyUp, true)
  document.addEventListener("mousemove", handleMouseMove, true)
  document.addEventListener("click", handleClick, true)
  window.addEventListener("blur", handleBlur)

  console.log("[alive-tagger] Element selector ready. Hold Cmd/Ctrl and click to select.")

  // Return cleanup function
  return () => {
    document.removeEventListener("keydown", handleKeyDown, true)
    document.removeEventListener("keyup", handleKeyUp, true)
    document.removeEventListener("mousemove", handleMouseMove, true)
    document.removeEventListener("click", handleClick, true)
    window.removeEventListener("blur", handleBlur)

    // Remove overlay elements
    document.getElementById("alive-tagger-overlay")?.remove()
    document.getElementById("alive-tagger-label")?.remove()

    ;(window as unknown as Record<string, boolean>).__aliveTaggerInitialized = false
    console.log("[alive-tagger] Cleaned up")
  }
}

// Auto-initialize when in browser
if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAliveTagger())
  } else {
    // Small delay to ensure React has rendered
    setTimeout(() => initAliveTagger(), 100)
  }
}
