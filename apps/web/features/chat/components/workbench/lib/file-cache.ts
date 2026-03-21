/**
 * Unified file cache for workbench views.
 * Single source of truth for file list and content caching.
 * Eliminates duplicate cache key generation and invalidation logic.
 */

import type { FileContent, FileInfo } from "./file-api"

const CONTENT_TTL = 30_000
const MAX_CONTENT_ENTRIES = 50

// --- Shared cache key ---

export function cacheKey(workspace: string, worktree: string | null | undefined, path: string): string {
  const scope = worktree ? `wt/${worktree}` : "base"
  return `${workspace}::${scope}::${path}`
}

// --- File list cache (directory listings, no TTL) ---

const listCache = new Map<string, FileInfo[]>()

export function getCachedList(key: string): FileInfo[] | undefined {
  return listCache.get(key)
}

export function setCachedList(key: string, files: FileInfo[]): void {
  listCache.set(key, files)
}

export function hasCachedList(key: string): boolean {
  return listCache.has(key)
}

// --- File content cache (TTL + LRU eviction) ---

const contentCache = new Map<string, { content: FileContent; timestamp: number }>()

export function getCachedContent(key: string): FileContent | null {
  const entry = contentCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CONTENT_TTL) {
    contentCache.delete(key)
    return null
  }
  return entry.content
}

export function setCachedContent(key: string, content: FileContent): void {
  if (contentCache.size >= MAX_CONTENT_ENTRIES) {
    const oldestKey = contentCache.keys().next().value
    if (oldestKey) contentCache.delete(oldestKey)
  }
  contentCache.set(key, { content, timestamp: Date.now() })
}

// --- Optimistic updates ---

/** Remove a file from its parent's cached listing without an API call. Returns true if cache was updated. */
export function optimisticRemoveFromList(
  workspace: string,
  worktree: string | null | undefined,
  parentPath: string,
  fileName: string,
): boolean {
  const key = cacheKey(workspace, worktree, parentPath)
  const list = listCache.get(key)
  if (!list) return false
  const filtered = list.filter(f => f.name !== fileName)
  if (filtered.length === list.length) return false
  listCache.set(key, filtered)
  return true
}

// --- Invalidation ---

function invalidateMap(map: Map<string, unknown>, workspace?: string, worktree?: string | null, path?: string): void {
  if (workspace && path !== undefined) {
    map.delete(cacheKey(workspace, worktree, path))
    return
  }
  if (workspace) {
    const scope = worktree ? `wt/${worktree}` : "base"
    const prefix = `${workspace}::${scope}::`
    for (const key of map.keys()) {
      if (key.startsWith(prefix)) {
        map.delete(key)
      }
    }
    return
  }
  map.clear()
}

export function invalidateList(workspace?: string, worktree?: string | null, path?: string): void {
  invalidateMap(listCache, workspace, worktree, path)
}

export function invalidateContent(workspace?: string, worktree?: string | null, path?: string): void {
  invalidateMap(contentCache, workspace, worktree, path)
}
