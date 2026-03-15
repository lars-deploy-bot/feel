"use client"

import { ChevronRight, File, Folder } from "lucide-react"
import { memo, useCallback, useEffect, useState } from "react"
import { type FileInfo, listFiles, type SearchResult, searchFiles } from "./lib/file-api"
import { getFileColor } from "./lib/file-colors"
import { useFileChangeVersion } from "./lib/file-events"

interface FileTreeProps {
  workspace: string
  worktree?: string | null
  activeFile: string | null
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  filter?: string
}

// Global cache for file listings - persists across re-renders
const fileCache = new Map<string, FileInfo[]>()

function getCacheKey(workspace: string, worktree: string | null | undefined, path: string): string {
  const scope = worktree ? `wt/${worktree}` : "base"
  return `${workspace}::${scope}::${path}`
}

export function FileTree({
  workspace,
  worktree,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
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
      const res = await searchFiles(workspace, query, worktree)
      if (!mounted) return
      if (res.ok) setResults(res.data)
      setLoading(false)
    }, 150) // debounce

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [workspace, worktree, query])

  return (
    <div className="h-full overflow-y-auto text-[13px] py-1">
      {loading && results.length === 0 && (
        <div className="px-3 py-2 text-neutral-400 dark:text-neutral-600">Searching...</div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="px-3 py-2 text-neutral-400 dark:text-neutral-600">No files found</div>
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
            className={`w-full flex items-center gap-1.5 px-2 py-1 text-left transition-colors ${
              isActive
                ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-neutral-800 dark:hover:text-neutral-300"
            }`}
          >
            <File size={14} strokeWidth={1.5} className={`shrink-0 ${getFileColor(item.name)}`} />
            <span className="truncate">
              <span>{item.name}</span>
              {dir && <span className="text-neutral-400 dark:text-neutral-600 ml-1.5 text-[11px]">{dir}</span>}
            </span>
          </button>
        )
      })}

      {results.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-600">
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
}: TreeLevelProps) {
  const cacheKey = getCacheKey(workspace, worktree, path)
  const [files, setFiles] = useState<FileInfo[]>(() => fileCache.get(cacheKey) || [])
  const [loading, setLoading] = useState(!fileCache.has(cacheKey))
  const [error, setError] = useState<string | null>(null)
  const changeVersion = useFileChangeVersion()

  useEffect(() => {
    // Already cached - no need to fetch
    if (fileCache.has(cacheKey)) {
      setFiles(fileCache.get(cacheKey)!)
      setLoading(false)
      return
    }

    let mounted = true

    async function load() {
      // Stale-while-revalidate: only show spinner on initial load, not revalidation
      if (files.length === 0) setLoading(true)
      const result = await listFiles(workspace, path, worktree)
      if (!mounted) return

      if (result.ok) {
        // Sort: folders first, then files, alphabetically
        const sorted = [...result.data].sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        fileCache.set(cacheKey, sorted)
        setFiles(sorted)
        setError(null)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [workspace, worktree, path, cacheKey, changeVersion])

  if (loading && depth === 0) {
    return <div className="px-3 py-2 text-neutral-400 dark:text-neutral-600">Loading...</div>
  }

  if (error && depth === 0) {
    return <div className="px-3 py-2 text-neutral-400 dark:text-neutral-500">{error}</div>
  }

  if (files.length === 0 && depth === 0 && !loading) {
    return <div className="px-3 py-2 text-neutral-400 dark:text-neutral-600">Empty</div>
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
}: TreeNodeProps) {
  const isFolder = item.type === "directory"

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(item.path)
    } else {
      onSelectFile(item.path)
    }
  }, [isFolder, item.path, onToggleFolder, onSelectFile])

  const paddingLeft = 8 + depth * 12

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full h-7 flex items-center gap-1 text-left transition-colors ${
          isActive
            ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white"
            : "text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-neutral-800 dark:hover:text-neutral-300"
        }`}
        style={{ paddingLeft }}
      >
        {isFolder ? (
          <ChevronRight
            size={14}
            strokeWidth={1.5}
            className={`shrink-0 text-neutral-400 dark:text-neutral-600 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        {isFolder ? (
          <Folder size={14} strokeWidth={1.5} className="shrink-0 text-amber-500/80" />
        ) : (
          <File size={14} strokeWidth={1.5} className={`shrink-0 ${getFileColor(item.name)}`} />
        )}
        <span className="truncate pr-2">{item.name}</span>
      </button>

      {isFolder && isExpanded && (
        <TreeLevel
          workspace={workspace}
          worktree={worktree}
          path={item.path}
          depth={depth + 1}
          activeFile={activeFile}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onSelectFile={onSelectFile}
        />
      )}
    </>
  )
})

// Export cache invalidation for manual refresh
export function invalidateFileCache(workspace?: string, worktree?: string | null, path?: string): void {
  if (workspace && path !== undefined) {
    fileCache.delete(getCacheKey(workspace, worktree, path))
    return
  }
  if (workspace) {
    const scope = worktree ? `wt/${worktree}` : "base"
    for (const key of fileCache.keys()) {
      if (key.startsWith(`${workspace}::${scope}::`)) {
        fileCache.delete(key)
      }
    }
    return
  }
  fileCache.clear()
}
