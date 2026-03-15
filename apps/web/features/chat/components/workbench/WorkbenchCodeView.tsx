"use client"

import { FilePlus, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { CodeViewer } from "./CodeViewer"
import { FileTree, invalidateFileCache } from "./FileTree"
import { useFileWatcher } from "./hooks/useFileWatcher"
import { useWorkbenchShortcuts } from "./hooks/useWorkbenchShortcuts"
import { getParentFilePath } from "./lib/file-paths"
import { NewFileInput } from "./NewFileInput"
import { PanelBar } from "./ui"

interface WorkbenchCodeViewProps extends WorkbenchViewProps {
  filePath: string | null
  expandedFolders: Set<string>
  treeWidth: number
  treeCollapsed: boolean
  onSelectFile: (path: string) => void
  onCloseFile: () => void
  onToggleFolder: (path: string) => void
  onSetTreeWidth: (width: number) => void
  onToggleTreeCollapsed: () => void
}

const MIN_TREE_WIDTH = 120
const MAX_TREE_WIDTH = 400

export function WorkbenchCodeView({
  workspace,
  worktree,
  filePath,
  expandedFolders,
  treeWidth,
  treeCollapsed,
  onSelectFile,
  onCloseFile,
  onToggleFolder,
  onSetTreeWidth,
  onToggleTreeCollapsed,
}: WorkbenchCodeViewProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [fileFilter, setFileFilter] = useState("")
  const filterInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Live file watching — invalidates caches and triggers re-renders on file changes
  useFileWatcher({ workspace, worktree })

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      const clampedWidth = Math.max(MIN_TREE_WIDTH, Math.min(MAX_TREE_WIDTH, newWidth))
      onSetTreeWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, onSetTreeWidth])

  // Keyboard: Escape closes file (scoped via workbench shortcut handler)
  const handleEscapeClose = useCallback(
    (e: KeyboardEvent) => {
      if (filePath) {
        e.preventDefault()
        onCloseFile()
      }
    },
    [filePath, onCloseFile],
  )
  useWorkbenchShortcuts([{ id: "codeview-escape", key: "Escape", handler: handleEscapeClose }])

  return (
    <div ref={containerRef} className={`h-full flex bg-white dark:bg-[#0d0d0d] ${isResizing ? "select-none" : ""}`}>
      {/* File tree sidebar */}
      {!treeCollapsed && (
        <div
          className="flex flex-col shrink-0 border-r border-black/[0.08] dark:border-white/[0.04]"
          style={{ width: treeWidth }}
        >
          {/* Tree header */}
          <PanelBar className="justify-between">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Files</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsCreatingFile(true)}
                className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 rounded transition-colors"
                title="New file"
              >
                <FilePlus size={14} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={onToggleTreeCollapsed}
                className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 rounded transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={14} strokeWidth={1.5} />
              </button>
            </div>
          </PanelBar>

          {/* Search input — always visible */}
          <div className="px-2 py-1.5 border-b border-black/[0.06] dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 h-6 px-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04]">
              <Search size={12} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-600 shrink-0" />
              <input
                ref={filterInputRef}
                type="text"
                value={fileFilter}
                onChange={e => setFileFilter(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape" && fileFilter) {
                    e.preventDefault()
                    e.stopPropagation()
                    setFileFilter("")
                  }
                }}
                placeholder="Search files..."
                className="flex-1 min-w-0 bg-transparent text-[12px] text-neutral-800 dark:text-neutral-200 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              />
              {fileFilter && (
                <button
                  type="button"
                  onClick={() => setFileFilter("")}
                  className="p-0.5 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 rounded transition-colors shrink-0"
                >
                  <X size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* Tree content */}
          <div className="flex-1 overflow-hidden">
            {isCreatingFile && (
              <NewFileInput
                workspace={workspace}
                worktree={worktree}
                onCreated={filePath => {
                  setIsCreatingFile(false)
                  invalidateFileCache(workspace, worktree, getParentFilePath(filePath))
                  onSelectFile(filePath)
                }}
                onCancel={() => setIsCreatingFile(false)}
              />
            )}
            <FileTree
              workspace={workspace}
              worktree={worktree}
              activeFile={filePath}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              filter={fileFilter}
            />
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!treeCollapsed && (
        // biome-ignore lint/a11y/noStaticElementInteractions: resize handle requires mouse interaction
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors relative group"
          onMouseDown={handleMouseDown}
        >
          {isResizing && <div className="absolute inset-y-0 -left-1 -right-1 bg-sky-500/20" />}
        </div>
      )}

      {/* Code viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Collapsed tree toggle */}
        {treeCollapsed && (
          <PanelBar>
            <button
              type="button"
              onClick={onToggleTreeCollapsed}
              className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 rounded transition-colors"
              title="Show sidebar"
            >
              <PanelLeftOpen size={14} strokeWidth={1.5} />
            </button>
          </PanelBar>
        )}

        {/* Code content */}
        {filePath ? (
          <CodeViewer workspace={workspace} worktree={worktree} filePath={filePath} onClose={onCloseFile} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-sm">
            <span>Select a file to view</span>
          </div>
        )}
      </div>
    </div>
  )
}
