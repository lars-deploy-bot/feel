"use client"
import { createContext, type ReactNode, useCallback, useContext, useState } from "react"

export interface SandboxEntry {
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

/** Preview mode for the sandbox panel */
export type PreviewMode = "site" | "code"

/** State for the preview panel */
export interface PreviewState {
  mode: PreviewMode
  /** Current path in site preview (URL path) */
  sitePath: string
  /** Currently open file path (for code view) */
  filePath: string | null
  /** Expanded folders in the file tree */
  expandedFolders: Set<string>
  /** Width of the file tree sidebar */
  treeWidth: number
  /** Whether tree sidebar is collapsed */
  treeCollapsed: boolean
}

interface SandboxContextType {
  entries: SandboxEntry[]
  addEntry: (entry: Omit<SandboxEntry, "id" | "timestamp">) => void
  clearEntries: () => void
  /** Currently selected element (from alive-tagger) */
  selectedElement: ElementSelection | null
  /** Set selected element - called from Sandbox when receiving postMessage */
  setSelectedElement: (element: ElementSelection | null) => void
  /** Callback for when element is selected - set by chat page to insert into input */
  onElementSelect: ((element: ElementSelection) => void) | null
  /** Register the callback for element selection */
  registerElementSelectHandler: (handler: (element: ElementSelection) => void) => void
  /** Preview panel state */
  preview: PreviewState
  /** Set preview mode */
  setPreviewMode: (mode: PreviewMode) => void
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
  /** Set site preview path */
  setSitePath: (path: string) => void
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined)

const DEFAULT_TREE_WIDTH = 200

const DEFAULT_PREVIEW_STATE: PreviewState = {
  mode: "site",
  sitePath: "/",
  filePath: null,
  expandedFolders: new Set<string>(),
  treeWidth: DEFAULT_TREE_WIDTH,
  treeCollapsed: false,
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SandboxEntry[]>([])
  const [selectedElement, setSelectedElementState] = useState<ElementSelection | null>(null)
  const [onElementSelect, setOnElementSelect] = useState<((element: ElementSelection) => void) | null>(null)
  const [preview, setPreview] = useState<PreviewState>(DEFAULT_PREVIEW_STATE)

  const addEntry = (entry: Omit<SandboxEntry, "id" | "timestamp">) => {
    const newEntry: SandboxEntry = {
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
      if (element && onElementSelect) {
        onElementSelect(element)
      }
    },
    [onElementSelect],
  )

  const registerElementSelectHandler = useCallback((handler: (element: ElementSelection) => void) => {
    setOnElementSelect(() => handler)
  }, [])

  const setPreviewMode = useCallback((mode: PreviewMode) => {
    setPreview(prev => ({ ...prev, mode }))
  }, [])

  const openFile = useCallback((filePath: string) => {
    // Auto-expand parent folders when opening a file
    const parts = filePath.split("/")
    const parentPaths: string[] = []
    for (let i = 1; i < parts.length; i++) {
      parentPaths.push(parts.slice(0, i).join("/"))
    }

    setPreview(prev => {
      const newExpanded = new Set(prev.expandedFolders)
      for (const p of parentPaths) {
        newExpanded.add(p)
      }
      return { ...prev, mode: "code", filePath, expandedFolders: newExpanded }
    })
  }, [])

  const closeFile = useCallback(() => {
    setPreview(prev => ({ ...prev, filePath: null }))
  }, [])

  const toggleFolder = useCallback((path: string) => {
    setPreview(prev => {
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
    setPreview(prev => ({ ...prev, treeWidth: width }))
  }, [])

  const toggleTreeCollapsed = useCallback(() => {
    setPreview(prev => ({ ...prev, treeCollapsed: !prev.treeCollapsed }))
  }, [])

  const setSitePath = useCallback((sitePath: string) => {
    setPreview(prev => ({ ...prev, sitePath }))
  }, [])

  return (
    <SandboxContext.Provider
      value={{
        entries,
        addEntry,
        clearEntries,
        selectedElement,
        setSelectedElement,
        onElementSelect,
        registerElementSelectHandler,
        preview,
        setPreviewMode,
        openFile,
        closeFile,
        toggleFolder,
        setTreeWidth,
        toggleTreeCollapsed,
        setSitePath,
      }}
    >
      {children}
    </SandboxContext.Provider>
  )
}

export function useSandboxContext() {
  const context = useContext(SandboxContext)
  if (!context) {
    throw new Error("useSandboxContext must be used within SandboxProvider")
  }
  return context
}
