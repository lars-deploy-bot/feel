import { readdir } from "node:fs/promises"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { RuntimePathValidationError, SANDBOX_WORKSPACE_ROOT } from "@webalive/sandbox"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { structuredErrorResponse } from "@/lib/api/responses"
import { type ResolvedDomain, resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { SandboxNotReadyError } from "@/lib/sandbox/connect-sandbox"
import { listE2bDirectory } from "@/lib/sandbox/e2b-file-runtime"

interface FileInfo {
  name: string
  type: "file" | "directory"
  size: number
  modified: string
  path: string
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    // Auth hardening: full user + workspace verification (not just cookie check)
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
    }

    const body = await request.json()

    const authorized = await verifyWorkspaceAccess(user, body, `[Files ${requestId}]`)
    if (!authorized) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, { status: 403, details: { requestId } })
    }

    const workspaceName = body.workspace as string | undefined
    const targetPath: string = body.path || ""

    // E2B branch: resolve domain runtime before filesystem checks
    if (workspaceName) {
      const domain = await resolveDomainRuntime(workspaceName)
      if (domain?.execution_mode === "e2b") {
        return handleE2bList(domain, targetPath, requestId)
      }
    }

    // Systemd path: existing getWorkspace() + node:fs logic
    const workspaceResult = await getWorkspace({ body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    const fullPath = path.join(workspaceResult.workspace, targetPath)

    // Security check: ensure path is within workspace
    const resolvedPath = path.resolve(fullPath)
    const resolvedWorkspace = path.resolve(workspaceResult.workspace)
    if (!isPathWithinWorkspace(resolvedPath, resolvedWorkspace)) {
      console.warn(`[Files ${requestId}] Path traversal blocked: ${resolvedPath} outside ${resolvedWorkspace}`)
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId },
      })
    }

    try {
      const entries = await readdir(fullPath, { withFileTypes: true })

      const files: FileInfo[] = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: 0,
        modified: "",
        path: path.join(targetPath, entry.name),
      }))

      return NextResponse.json({
        ok: true,
        path: targetPath,
        workspace: workspaceResult.workspace,
        files,
      })
    } catch (fsError) {
      console.error(`[Files ${requestId}] Error reading directory:`, fsError)
      Sentry.captureException(fsError)
      return structuredErrorResponse(ErrorCodes.FILE_READ_ERROR, {
        status: 500,
        details: {
          requestId,
          filePath: targetPath,
          error: fsError instanceof Error ? fsError.message : "Unknown error",
        },
      })
    }
  } catch (error) {
    console.error("Files API error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status: 500,
      details: {
        requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

async function handleE2bList(domain: ResolvedDomain, targetPath: string, requestId: string): Promise<NextResponse> {
  try {
    const entries = await listE2bDirectory(domain, targetPath)

    const files: FileInfo[] = entries.map(entry => ({
      name: entry.name,
      type: entry.kind,
      size: 0,
      modified: "",
      path: entry.path,
    }))

    return NextResponse.json({
      ok: true,
      path: targetPath,
      workspace: SANDBOX_WORKSPACE_ROOT,
      files,
    })
  } catch (err) {
    if (err instanceof RuntimePathValidationError) {
      console.warn(`[Files ${requestId}] E2B path traversal blocked: ${targetPath}`)
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId },
      })
    }
    if (err instanceof SandboxNotReadyError) {
      return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
    }
    console.error(`[Files ${requestId}] E2B list error:`, err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.FILE_READ_ERROR, {
      status: 500,
      details: {
        requestId,
        filePath: targetPath,
        error: err instanceof Error ? err.message : "Unknown error",
      },
    })
  }
}
