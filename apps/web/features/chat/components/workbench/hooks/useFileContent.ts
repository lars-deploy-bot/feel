/**
 * Hook for loading file contents with caching.
 * Uses the shared file-cache for storage and invalidation.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { FileContent } from "../lib/file-api"
import { readFile } from "../lib/file-api"
import { cacheKey, getCachedContent, setCachedContent } from "../lib/file-cache"
import { useFileChangeVersion } from "../lib/file-events"

interface UseFileContentResult {
  file: FileContent | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useFileContent(workspace: string, path: string, worktree?: string | null): UseFileContentResult {
  const key = cacheKey(workspace, worktree, path)
  const cached = getCachedContent(key)
  const changeVersion = useFileChangeVersion()

  const [file, setFile] = useState<FileContent | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const hasContentRef = useRef(!!cached)

  // Track whether we have content to avoid flash on revalidation
  useEffect(() => {
    hasContentRef.current = file !== null
  }, [file])

  const load = useCallback(
    async (skipCache = false) => {
      // Check cache first (unless forced reload)
      if (!skipCache) {
        const cachedContent = getCachedContent(key)
        if (cachedContent) {
          setFile(cachedContent)
          setLoading(false)
          setError(null)
          return
        }
      }

      // Stale-while-revalidate: only show loading spinner on initial load.
      // If we already have content displayed, keep it visible during refetch.
      if (!hasContentRef.current) {
        setLoading(true)
      }
      setError(null)

      try {
        const content = await readFile(workspace, path, worktree)
        setCachedContent(key, content)
        setFile(content)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file")
      } finally {
        setLoading(false)
      }
    },
    [workspace, path, worktree, key],
  )

  // Re-run when file changes are notified (cache was invalidated by useFileWatcher)
  useEffect(() => {
    load()
  }, [load, changeVersion])

  // Force reload bypasses cache
  const reload = useCallback(() => load(true), [load])

  return { file, loading, error, reload }
}
