"use client"

import { ChevronRight, File, Folder, Trash2 } from "lucide-react"
import { memo, useCallback, useEffect, useState } from "react"
import type { FileInfo, SearchResult } from "./lib/file-api"
import { listFiles, searchFiles } from "./lib/file-api"
import { cacheKey, getCachedList, hasCachedList, setCachedList } from "./lib/file-cache"
import { getFileColor } from "./lib/file-colors"
import { useFileChangeVersion } from "./lib/file-events"

interface FileTreeProps {
  workspace: string
  worktree?: string | null
  activeFile: string | null
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  onDeleteFile?: (path: string, isDir: boolean) => void
  filter?: string
}

export function FileTree({
  workspace,
  worktree,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  onDeleteFile,
  filter,
}: FileTreeProps) {
  const activeFilter = filter?.trim() || ""

  // When filtering: show flat search results instead of the tree
  if (activeFilter) {
    return (
      <SearchResults
        workspace={workspace}
        worktree={worktree}
        query={activeFilter}
        activeFile={activeFile}
        onSelectFile={onSelectFile}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto text-[13px] py-1">
      <TreeLevel
        workspace={workspace}
        worktree={worktree}
        path=""
        depth={0}
        activeFile={activeFile}
        expandedFolders={expandedFolders}
        onToggleFolder={onToggleFolder}
        onSelectFile={onSelectFile}
        onDeleteFile={onDeleteFile}
      />
    </div>
  )
}

// --- Flat search results (replaces tree when filtering) ---

interface SearchResultsProps {
  workspace: string
  worktree?: string | null
  query: string
  activeFile: string | null
  onSelectFile: (path: string) => void
}

function SearchResults({ workspace, worktree, query, activeFile, onSelectFile }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    let mounted = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchFiles(workspace, query, worktree)
        if (mounted) setResults(data)
      } catch {
        // Search errors are non-critical — silently handled
      } finally {
        if (mounted) setLoading(false)
      }
    }, 150) // debounce

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [workspace, worktree, query])

  return (
    <div className="h-full overflow-y-auto text-[13px] py-1">
      {loading && results.length === 0 && (
        <div className="px-3 py-2 text-[13px] text-zinc-300 dark:text-zinc-700">Searching</div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="px-3 py-2 text-[13px] text-zinc-300 dark:text-zinc-700">No matches</div>
      )}

      {results.map(item => {
        const isActive = activeFile === item.path
        // Show parent directory for context
        const dir = item.path.includes("/") ? item.path.substring(0, item.path.lastIndexOf("/")) : ""

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onSelectFile(item.path)}
            className={`w-full flex items-center gap-1.5 px-2 h-8 text-left transition-colors ${
              isActive
                ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <File size={14} strokeWidth={1.5} className={`shrink-0 ${getFileColor(item.name)}`} />
            <span className="truncate">
              <span>{item.name}</span>
              {dir && <span className="text-black/30 dark:text-white/25 ml-1.5 text-[11px]">{dir}</span>}
            </span>
          </button>
        )
      })}

      {results.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-black/30 dark:text-white/25">
          {results.length} {results.length === 1 ? "file" : "files"}
        </div>
      )}
    </div>
  )
}

// --- Normal tree (when not filtering) ---

interface TreeLevelProps {
  workspace: string
  worktree?: string | null
  path: string
  depth: number
  activeFile: string | null
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  onDeleteFile?: (path: string, isDir: boolean) => void
}

function TreeLevel({
  workspace,
  worktree,
  path,
  depth,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  onDeleteFile,
}: TreeLevelProps) {
  const key = cacheKey(workspace, worktree, path)
  const [files, setFiles] = useState<FileInfo[]>(() => getCachedList(key) || [])
  const [loading, setLoading] = useState(!hasCachedList(key))
  const [error, setError] = useState<string | null>(null)
  const changeVersion = useFileChangeVersion()

  useEffect(() => {
    // Already cached - no need to fetch
    if (hasCachedList(key)) {
      setFiles(getCachedList(key)!)
      setLoading(false)
      return
    }

    let mounted = true

    async function load() {
      // Stale-while-revalidate: only show spinner on initial load, not revalidation
      if (files.length === 0) setLoading(true)
      try {
        const data = await listFiles(workspace, path, worktree)
        if (!mounted) return
        // Sort: folders first, then files, alphabetically
        const sorted = [...data].sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setCachedList(key, sorted)
        setFiles(sorted)
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Failed to load files")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [workspace, worktree, path, key, changeVersion])

  if (loading && depth === 0) {
    return <div className="px-3 py-2 text-[13px] text-zinc-300 dark:text-zinc-700">Loading</div>
  }

  if (error && depth === 0) {
    return <div className="px-3 py-2 text-[13px] text-black/30 dark:text-white/25">{error}</div>
  }

  if (files.length === 0 && depth === 0 && !loading) {
    return <div className="px-3 py-2 text-[13px] text-zinc-300 dark:text-zinc-700">No files</div>
  }

  return (
    <>
      {files.map(item => (
        <TreeNode
          key={item.path}
          workspace={workspace}
          worktree={worktree}
          item={item}
          depth={depth}
          isActive={activeFile === item.path}
          isExpanded={item.type === "directory" && expandedFolders.has(item.path)}
          activeFile={activeFile}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </>
  )
}

interface TreeNodeProps {
  workspace: string
  worktree?: string | null
  item: FileInfo
  depth: number
  isActive: boolean
  isExpanded: boolean
  activeFile: string | null
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  onDeleteFile?: (path: string, isDir: boolean) => void
}

// Memoize TreeNode to prevent re-renders when other nodes change
const TreeNode = memo(function TreeNode({
  workspace,
  worktree,
  item,
  depth,
  isActive,
  isExpanded,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  onDeleteFile,
}: TreeNodeProps) {
  const isFolder = item.type === "directory"

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(item.path)
    } else {
      onSelectFile(item.path)
    }
  }, [isFolder, item.path, onToggleFolder, onSelectFile])

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDeleteFile?.(item.path, isFolder)
    },
    [item.path, isFolder, onDeleteFile],
  )

  const paddingLeft = 8 + depth * 12

  return (
    <>
      <div
        className={`group/node w-full h-8 flex items-center text-left transition-colors ${
          isActive
            ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-zinc-800 dark:hover:text-zinc-300"
        }`}
      >
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 min-w-0 h-full flex items-center gap-1.5"
          style={{ paddingLeft }}
        >
          {isFolder ? (
            <ChevronRight
              size={14}
              strokeWidth={1.5}
              className={`shrink-0 text-black/30 dark:text-white/25 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="w-[14px] shrink-0" />
          )}
          {isFolder ? (
            <Folder size={14} strokeWidth={1.5} className="shrink-0 text-amber-500/80" />
          ) : (
            <File size={14} strokeWidth={1.5} className={`shrink-0 ${getFileColor(item.name)}`} />
          )}
          <span className="truncate pr-1">{item.name}</span>
        </button>

        {onDeleteFile && (
          <button
            type="button"
            onClick={handleDelete}
            className="opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100 shrink-0 p-1 mr-1.5 rounded text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-all"
            title={`Delete ${item.name}`}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isFolder && isExpanded && (
        <div className="relative">
          {/* Indent guide line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-black/[0.06] dark:bg-white/[0.06]"
            style={{ left: 8 + depth * 12 + 7 }}
          />
          <TreeLevel
            workspace={workspace}
            worktree={worktree}
            path={item.path}
            depth={depth + 1}
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
          />
        </div>
      )}
    </>
  )
})
