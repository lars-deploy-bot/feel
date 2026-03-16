import { readdir } from "node:fs/promises"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"

/** Entries to skip when walking the tree */
const SKIP_DIRS = new Set([".git", "node_modules", ".next", ".turbo", ".cache", ".bun", ".vite", "__pycache__"])

const SKIP_FILES = new Set([".DS_Store", "Thumbs.db"])

const MAX_RESULTS = 100
const MAX_DEPTH = 8

interface SearchResult {
  name: string
  path: string
}

/** Recursively walk and collect files matching the query */
async function walkAndMatch(
  root: string,
  dir: string,
  query: string,
  results: SearchResult[],
  depth: number,
): Promise<void> {
  if (results.length >= MAX_RESULTS || depth > MAX_DEPTH) return

  let entries: import("node:fs").Dirent[]
  try {
    entries = (await readdir(path.join(root, dir), { withFileTypes: true })) as import("node:fs").Dirent[]
  } catch (_err) {
    // Directory may not be readable — skip silently
    return
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) return

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      const subdir = dir ? `${dir}/${entry.name}` : entry.name
      await walkAndMatch(root, subdir, query, results, depth + 1)
    } else {
      if (SKIP_FILES.has(entry.name)) continue
      if (entry.name.toLowerCase().includes(query)) {
        const filePath = dir ? `${dir}/${entry.name}` : entry.name
        results.push({ name: entry.name, path: filePath })
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
    }

    const body = await request.json()

    const authorized = await verifyWorkspaceAccess(user, body, `[FileSearch ${requestId}]`)
    if (!authorized) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, { status: 403, details: { requestId } })
    }

    const query = (body.query as string | undefined)?.trim().toLowerCase()
    if (!query) {
      return NextResponse.json({ ok: true, results: [] })
    }

    const workspaceResult = await getWorkspace({ body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    const resolvedWorkspace = path.resolve(workspaceResult.workspace)
    if (!isPathWithinWorkspace(resolvedWorkspace, resolvedWorkspace)) {
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, { status: 403, details: { requestId } })
    }

    const results: SearchResult[] = []
    await walkAndMatch(resolvedWorkspace, "", query, results, 0)

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error("File search API error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status: 500,
      details: { requestId, error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}
