/**
 * File API client for workbench views.
 * All functions throw on failure (fail fast). Callers catch for UI error display.
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

export interface SearchResult {
  name: string
  path: string
}

// Base shape every API route returns
interface ApiEnvelope {
  ok: boolean
  error?: string
}

// Success response shapes (fields are required when ok=true)
interface FileListPayload extends ApiEnvelope {
  files: FileInfo[]
}

interface FileWritePayload extends ApiEnvelope {
  path: string
}

interface FileSearchPayload extends ApiEnvelope {
  results: SearchResult[]
}

interface FileReadPayload extends ApiEnvelope {
  content: string
  filename: string
  language: string
  size: number
}

async function post<T extends ApiEnvelope>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data: T = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `${url} returned ${response.status}`)
  }

  return data
}

export async function listFiles(workspace: string, path: string, worktree?: string | null): Promise<FileInfo[]> {
  const data = await post<FileListPayload>("/api/files", { workspace, path, worktree: worktree || undefined })
  return data.files
}

export async function writeFile(
  workspace: string,
  path: string,
  content: string,
  worktree?: string | null,
): Promise<void> {
  await post<FileWritePayload>("/api/files/write", { workspace, path, content, worktree: worktree || undefined })
}

export async function searchFiles(workspace: string, query: string, worktree?: string | null): Promise<SearchResult[]> {
  const data = await post<FileSearchPayload>("/api/files/search", {
    workspace,
    query,
    worktree: worktree || undefined,
  })
  return data.results
}

export async function readFile(workspace: string, path: string, worktree?: string | null): Promise<FileContent> {
  const { content, filename, language, size } = await post<FileReadPayload>("/api/files/read", {
    workspace,
    path,
    worktree: worktree || undefined,
  })
  return { content, filename, language, size }
}

export async function deleteFile(
  workspace: string,
  path: string,
  options?: { worktree?: string | null; recursive?: boolean },
): Promise<void> {
  await post<ApiEnvelope & { deleted: string; type: string }>("/api/files/delete", {
    workspace,
    path,
    worktree: options?.worktree || undefined,
    recursive: options?.recursive,
  })
}

export async function uploadFile(
  workspace: string,
  file: File,
  worktree?: string | null,
): Promise<{ path: string; originalName: string }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("workspace", workspace)
  if (worktree) formData.append("worktree", worktree)

  const response = await fetch("/api/files/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  })

  const data = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(data.error?.message ?? data.message ?? `Upload failed (${response.status})`)
  }

  return { path: data.path, originalName: data.originalName }
}
