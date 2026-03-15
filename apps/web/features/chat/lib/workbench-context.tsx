"use client"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react"

export interface WorkbenchEntry {
  id: string
  timestamp: string
  type: "log" | "error" | "info" | "success"
  message: string
  data?: unknown
}

/** Element selection context from alive-tagger Cmd+Click */
export interface ElementSelection {
  displayName: string
  fileName: string
  lineNumber: number
  columnNumber?: number
}

/** View mode for the workbench */
export type WorkbenchView = "home" | "site" | "code" | "terminal" | "drive" | "events" | "agents" | "photos" | "kanban"

// ── Workbench View Contract ─────────────────────────────────────────────────

/** Base props every workbench view receives from the Workbench dispatcher. */
export interface WorkbenchViewProps {
  workspace: string
  worktree?: string | null
}

/** A keyboard shortcut registered by a workbench view. */
export interface WorkbenchShortcut {
  /** Unique identifier (for dedup/cleanup) */
  id: string
  /** Key to match (e.g., "Escape", "s", "f") */
  key: string
  /** Requires Ctrl (Win/Linux) or Cmd (Mac) */
  ctrlOrMeta?: boolean
  /** Handler called when the shortcut fires */
  handler: (e: KeyboardEvent) => void
}

/**
 * Type-safe view state registry. Views that need persistent state (survives
 * view switches) declare their shape here. Using `useViewState("foo", ...)`
 * without declaring "foo" in this map is a compiler error.
 *
 * @example
 * // 1. Declare the shape in ViewStateMap:
 * export interface ViewStateMap {
 *   drive: { selectedFile: string | null; treeWidth: number }
 * }
 * // 2. Use in the view:
 * const state = useViewState("drive", { selectedFile: null, treeWidth: 240 })
 * state.value.selectedFile  // string | null — fully typed, zero assertions
 */
export interface ViewStateMap {
  site: { device: "desktop" | "mobile" }
}

/** Internal typed storage — maps each declared view key to its state. */
type ViewStateStorage = { [K in keyof ViewStateMap]?: ViewStateMap[K] }

/** State for the workbench */
export interface WorkbenchState {
  view: WorkbenchView
  /** Currently open file path (for code view) */
  filePath: string | null
  /** Expanded folders in the file tree */
  expandedFolders: Set<string>
  /** Width of the file tree sidebar */
  treeWidth: number
  /** Whether tree sidebar is collapsed */
  treeCollapsed: boolean
}

interface WorkbenchContextType {
  entries: WorkbenchEntry[]
  addEntry: (entry: Omit<WorkbenchEntry, "id" | "timestamp">) => void
  clearEntries: () => void
  /** Currently selected element (from alive-tagger) */
  selectedElement: ElementSelection | null
  /** Set selected element - called from workbench when receiving postMessage */
  setSelectedElement: (element: ElementSelection | null) => void
  /** Callback for when element is selected - set by chat page to insert into input */
  onElementSelect: ((element: ElementSelection) => void) | null
  /** Register the callback for element selection */
  registerElementSelectHandler: (handler: (element: ElementSelection) => void) => void
  /** Whether element selector mode is active */
  selectorActive: boolean
  /** Activate element selector mode in the preview iframe */
  activateSelector: () => void
  /** Deactivate element selector mode */
  deactivateSelector: () => void
  /** Workbench state */
  workbench: WorkbenchState
  /** Set workbench view */
  setView: (view: WorkbenchView) => void
  /** Open a file in code view */
  openFile: (filePath: string) => void
  /** Close current file */
  closeFile: () => void
  /** Toggle folder expanded state */
  toggleFolder: (path: string) => void
  /** Set tree sidebar width */
  setTreeWidth: (width: number) => void
  /** Toggle tree sidebar collapsed */
  toggleTreeCollapsed: () => void
  /** Register keyboard shortcuts (returns cleanup function) */
  registerShortcuts: (shortcuts: WorkbenchShortcut[]) => () => void
  /** Typed view state storage — accessed via useViewState hook, not directly */
  viewStatesRef: React.RefObject<ViewStateStorage>
  /** Add a photobook image to the chat input — registered by the chat page */
  addImageToChat: ((imageKey: string) => void) | null
  /** Register the callback for adding images to chat */
  registerAddImageToChat: (handler: (imageKey: string) => void) => void
}

const WorkbenchContext = createContext<WorkbenchContextType | undefined>(undefined)

const DEFAULT_TREE_WIDTH = 200

const DEFAULT_WORKBENCH_STATE: WorkbenchState = {
  view: "site",
  filePath: null,
  expandedFolders: new Set<string>(),
  treeWidth: DEFAULT_TREE_WIDTH,
  treeCollapsed: false,
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WorkbenchEntry[]>([])
  const [selectedElement, setSelectedElementState] = useState<ElementSelection | null>(null)
  const [onElementSelect, setOnElementSelect] = useState<((element: ElementSelection) => void) | null>(null)
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState>(DEFAULT_WORKBENCH_STATE)
  const [selectorActive, setSelectorActive] = useState(false)
  const [addImageToChat, setAddImageToChat] = useState<((imageKey: string) => void) | null>(null)

  const addEntry = (entry: Omit<WorkbenchEntry, "id" | "timestamp">) => {
    const newEntry: WorkbenchEntry = {
      ...entry,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    }
    setEntries(prev => [...prev, newEntry])
  }

  const clearEntries = () => {
    setEntries([])
  }

  const setSelectedElement = useCallback(
    (element: ElementSelection | null) => {
      setSelectedElementState(element)
      // Deactivate selector when element is selected
      if (element) {
        setSelectorActive(false)
      }
      if (element && onElementSelect) {
        onElementSelect(element)
      }
    },
    [onElementSelect],
  )

  const activateSelector = useCallback(() => {
    setSelectorActive(prev => !prev)
  }, [])

  const deactivateSelector = useCallback(() => {
    setSelectorActive(false)
  }, [])

  const registerElementSelectHandler = useCallback((handler: (element: ElementSelection) => void) => {
    setOnElementSelect(() => handler)
  }, [])

  const registerAddImageToChat = useCallback((handler: (imageKey: string) => void) => {
    setAddImageToChat(() => handler)
  }, [])

  const setView = useCallback((view: WorkbenchView) => {
    setWorkbenchState(prev => ({ ...prev, view }))
  }, [])

  const openFile = useCallback((filePath: string) => {
    // Auto-expand parent folders when opening a file
    const parts = filePath.split("/")
    const parentPaths: string[] = []
    for (let i = 1; i < parts.length; i++) {
      parentPaths.push(parts.slice(0, i).join("/"))
    }

    setWorkbenchState(prev => {
      const newExpanded = new Set(prev.expandedFolders)
      for (const p of parentPaths) {
        newExpanded.add(p)
      }
      return { ...prev, view: "code", filePath, expandedFolders: newExpanded }
    })
  }, [])

  const closeFile = useCallback(() => {
    setWorkbenchState(prev => ({ ...prev, filePath: null }))
  }, [])

  const toggleFolder = useCallback((path: string) => {
    setWorkbenchState(prev => {
      const newExpanded = new Set(prev.expandedFolders)
      if (newExpanded.has(path)) {
        newExpanded.delete(path)
      } else {
        newExpanded.add(path)
      }
      return { ...prev, expandedFolders: newExpanded }
    })
  }, [])

  const setTreeWidth = useCallback((width: number) => {
    setWorkbenchState(prev => ({ ...prev, treeWidth: width }))
  }, [])

  const toggleTreeCollapsed = useCallback(() => {
    setWorkbenchState(prev => ({ ...prev, treeCollapsed: !prev.treeCollapsed }))
  }, [])

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────
  const shortcutsRef = useRef<Map<string, WorkbenchShortcut>>(new Map())

  const registerShortcuts = useCallback((shortcuts: WorkbenchShortcut[]) => {
    for (const s of shortcuts) {
      shortcutsRef.current.set(s.id, s)
    }
    return () => {
      for (const s of shortcuts) {
        shortcutsRef.current.delete(s.id)
      }
    }
  }, [])

  // Central keydown listener — replaces per-view window.addEventListener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current.values()) {
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue
        const hasModifier = e.ctrlKey || e.metaKey
        if (shortcut.ctrlOrMeta && !hasModifier) continue
        if (!shortcut.ctrlOrMeta && hasModifier) continue
        shortcut.handler(e)
        return
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // ── View State Persistence ──────────────────────────────────────────────
  const viewStatesRef = useRef<ViewStateStorage>({})

  return (
    <WorkbenchContext.Provider
      value={{
        entries,
        addEntry,
        clearEntries,
        selectedElement,
        setSelectedElement,
        onElementSelect,
        registerElementSelectHandler,
        selectorActive,
        activateSelector,
        deactivateSelector,
        workbench: workbenchState,
        setView,
        openFile,
        closeFile,
        toggleFolder,
        setTreeWidth,
        toggleTreeCollapsed,
        registerShortcuts,
        viewStatesRef,
        addImageToChat,
        registerAddImageToChat,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  )
}

export function useWorkbenchContext() {
  const context = useContext(WorkbenchContext)
  if (!context) {
    throw new Error("useWorkbenchContext must be used within WorkbenchProvider")
  }
  return context
}
