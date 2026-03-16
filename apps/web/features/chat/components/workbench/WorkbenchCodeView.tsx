"use client"

import { FilePlus, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkbenchContext, type WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { CodeViewer } from "./CodeViewer"
import { FileTree } from "./FileTree"
import { useFileWatcher } from "./hooks/useFileWatcher"
import { useWorkbenchShortcuts } from "./hooks/useWorkbenchShortcuts"
import { NewFileInput } from "./NewFileInput"
import { PanelBar } from "./ui"

const MIN_TREE_WIDTH = 160
const MAX_TREE_WIDTH = 400

export function WorkbenchCodeView({ workspace, worktree }: WorkbenchViewProps) {
  const { workbench, openFile, closeFile, toggleFolder, setTreeWidth, toggleTreeCollapsed } = useWorkbenchContext()
  const { filePath, expandedFolders, treeWidth, treeCollapsed } = workbench
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
      setTreeWidth(clampedWidth)
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
  }, [isResizing, setTreeWidth])

  // Keyboard: Escape closes file (scoped via workbench shortcut handler)
  const handleEscapeClose = useCallback(
    (e: KeyboardEvent) => {
      if (filePath) {
        e.preventDefault()
        closeFile()
      }
    },
    [filePath, closeFile],
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
          {/* Tree header — actions only, no label (the tab already says "Files") */}
          <PanelBar className="justify-end gap-1">
            <button
              type="button"
              onClick={() => setIsCreatingFile(true)}
              className="p-1.5 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors"
              title="New file"
            >
              <FilePlus size={15} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={toggleTreeCollapsed}
              className="p-1.5 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} strokeWidth={1.5} />
            </button>
          </PanelBar>

          {/* Search input — always visible */}
          <div className="px-2.5 py-2 border-b border-black/[0.06] dark:border-white/[0.04]">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] focus-within:border-black/[0.1] dark:focus-within:border-white/[0.1] transition-colors">
              <Search size={14} strokeWidth={1.5} className="text-black/30 dark:text-white/25 shrink-0" />
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
                className="flex-1 min-w-0 bg-transparent text-[13px] text-zinc-800 dark:text-zinc-200 outline-none placeholder:text-black/25 dark:placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Tree content */}
          <div className="flex-1 overflow-hidden">
            {isCreatingFile && (
              <NewFileInput
                workspace={workspace}
                worktree={worktree}
                onCreated={createdPath => {
                  setIsCreatingFile(false)
                  openFile(createdPath)
                }}
                onCancel={() => setIsCreatingFile(false)}
              />
            )}
            <FileTree
              workspace={workspace}
              worktree={worktree}
              activeFile={filePath}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onSelectFile={openFile}
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
              onClick={toggleTreeCollapsed}
              className="p-1.5 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors"
              title="Show sidebar"
            >
              <PanelLeftOpen size={15} strokeWidth={1.5} />
            </button>
          </PanelBar>
        )}

        {/* Code content */}
        {filePath ? (
          <CodeViewer workspace={workspace} worktree={worktree} filePath={filePath} onClose={closeFile} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-sm">
            <span>Select a file to view</span>
          </div>
        )}
      </div>
    </div>
  )
}
