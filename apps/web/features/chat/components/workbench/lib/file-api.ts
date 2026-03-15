/**
 * File API client for workbench views
 * Extracted to eliminate duplication between FilesView and CodeView
 */

export interface FileInfo {
  name: string
  type: "file" | "directory"
  size: number
  modified: string
  path: string
}

export interface FileContent {
  content: string
  filename: string
  language: string
  size: number
}

interface ApiResult<T> {
  ok: true
  data: T
}

interface ApiError {
  ok: false
  error: string
}

type ApiResponse<T> = ApiResult<T> | ApiError

export async function listFiles(
  workspace: string,
  path: string,
  worktree?: string | null,
): Promise<ApiResponse<FileInfo[]>> {
  try {
    const response = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, path, worktree: worktree || undefined }),
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || "Failed to load files" }
    }

    return { ok: true, data: data.files || [] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to load files" }
  }
}

export async function writeFile(
  workspace: string,
  path: string,
  content: string,
  worktree?: string | null,
): Promise<ApiResponse<{ path: string }>> {
  try {
    const response = await fetch("/api/files/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, path, content, worktree: worktree || undefined }),
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || "Failed to write file" }
    }

    return { ok: true, data: { path: data.path } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to write file" }
  }
}

export interface SearchResult {
  name: string
  path: string
}

export async function searchFiles(
  workspace: string,
  query: string,
  worktree?: string | null,
): Promise<ApiResponse<SearchResult[]>> {
  try {
    const response = await fetch("/api/files/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, query, worktree: worktree || undefined }),
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || "Search failed" }
    }

    return { ok: true, data: data.results || [] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Search failed" }
  }
}

export async function readFile(
  workspace: string,
  path: string,
  worktree?: string | null,
): Promise<ApiResponse<FileContent>> {
  try {
    const response = await fetch("/api/files/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, path, worktree: worktree || undefined }),
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || "Failed to load file" }
    }

    return {
      ok: true,
      data: {
        content: data.content,
        filename: data.filename,
        language: data.language,
        size: data.size,
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to load file" }
  }
}
